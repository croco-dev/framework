import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  compileDesktopWireSchema,
  DesktopWireSchemaProblem,
  parseDesktopWireValue,
  stringifyDesktopWireSchemaDescriptor,
} from "../index";

const CONTEXT = { contractMember: "project.readFile.input" } as const;

describe("DesktopWireSchema", () => {
  it("compiles every supported category into one deterministic descriptor", () => {
    const first = compileDesktopWireSchema(
      z.object({
        union: z.union([z.literal("open"), z.number()]),
        tags: z.array(z.string()).optional(),
        status: z.enum(["ready", "pending"]),
        nullable: z.boolean().nullable(),
        nested: z.object({ count: z.number(), enabled: z.boolean() }),
        literal: z.literal(null),
      }),
      CONTEXT,
    );
    const second = compileDesktopWireSchema(
      z.object({
        literal: z.literal(null),
        nested: z.object({ enabled: z.boolean(), count: z.number() }),
        nullable: z.boolean().nullable(),
        status: z.enum(["ready", "pending"]),
        tags: z.array(z.string()).optional(),
        union: z.union([z.number(), z.literal("open")]),
      }),
      CONTEXT,
    );

    expect(stringifyDesktopWireSchemaDescriptor(first)).toBe(
      stringifyDesktopWireSchemaDescriptor(second),
    );
    expect(first).toMatchSnapshot();
  });

  it("orders mixed enum values deterministically by type and code unit", () => {
    const first = compileDesktopWireSchema(
      z.nativeEnum({ NumericValue: 1, StringValue: "1" } as const),
      CONTEXT,
    );
    const second = compileDesktopWireSchema(
      z.nativeEnum({ StringValue: "1", NumericValue: 1 } as const),
      CONTEXT,
    );

    expect(first).toEqual(second);
    expect(first).toEqual({ kind: "enum", values: [1, "1"] });
  });

  it.each([
    ["any", z.any()],
    ["unknown", z.unknown()],
    ["transform", z.string().transform((value) => value.length)],
    ["preprocess", z.preprocess((value) => value, z.string())],
    ["refinement", z.string().refine((value) => value.length > 0)],
    ["built-in refinement", z.string().email()],
    ["class instance", z.instanceof(class DesktopValue {})],
    ["date", z.date()],
    ["map", z.map(z.string(), z.string())],
    ["set", z.set(z.string())],
    ["function", z.function()],
    ["symbol", z.symbol()],
  ])("rejects unsupported %s schemas without passthrough", (_name, schema) => {
    expect(() => compileDesktopWireSchema(schema, CONTEXT)).toThrowError(
      expect.objectContaining({
        code: "DESKTOP_WIRE_SCHEMA_INVALID",
        diagnostics: [
          expect.objectContaining({
            contractMember: CONTEXT.contractMember,
            recovery: expect.any(String),
          }),
        ],
      }),
    );
  });

  it("rejects recursive schemas with a stable diagnostic", () => {
    type RecursiveValue = { readonly children: readonly RecursiveValue[] };
    const recursive: z.ZodType<RecursiveValue> = z.lazy(() =>
      z.object({ children: z.array(recursive) }),
    );

    expect(() => compileDesktopWireSchema(recursive, CONTEXT)).toThrowError(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "DESKTOP_WIRE_SCHEMA_RECURSIVE",
            contractMember: "project.readFile.input",
          }),
        ],
      }),
    );
  });

  it("reports every unsupported member with source location and recovery", () => {
    let problem: DesktopWireSchemaProblem | undefined;

    try {
      compileDesktopWireSchema(z.object({ createdAt: z.date(), payload: z.unknown() }), {
        contractMember: "project.save.output",
        sourceLocation: { path: "src/project.contract.ts", line: 18, column: 9 },
      });
    } catch (error) {
      if (error instanceof DesktopWireSchemaProblem) problem = error;
    }

    expect(problem?.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
        contractMember: "project.save.output",
        schemaPath: ["createdAt"],
        sourceLocation: { path: "src/project.contract.ts", line: 18, column: 9 },
        recovery: expect.any(String),
      }),
      expect.objectContaining({
        code: "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
        contractMember: "project.save.output",
        schemaPath: ["payload"],
        recovery: expect.any(String),
      }),
    ]);
    expect(problem?.message).toContain("src/project.contract.ts:18:9");
  });

  it("rejects unknown keys and non-plain instances before Zod can strip them", () => {
    const schema = z.object({
      id: z.string(),
      nested: z.object({ enabled: z.boolean() }),
    });

    expect(() =>
      parseDesktopWireValue(
        schema,
        { id: "one", nested: { enabled: true, ignored: true } },
        CONTEXT,
      ),
    ).toThrowError(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "DESKTOP_WIRE_VALUE_INVALID",
            schemaPath: ["nested", "ignored"],
          }),
        ],
      }),
    );

    class ForgedElectronObject {
      public id = "one";
      public nested = { enabled: true };
    }

    expect(() => parseDesktopWireValue(schema, new ForgedElectronObject(), CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
    expect(
      parseDesktopWireValue(schema, { id: "one", nested: { enabled: true } }, CONTEXT),
    ).toEqual({ id: "one", nested: { enabled: true } });
  });

  it("rejects explicit dynamic object schemas and non-JSON optional or symbol values", () => {
    expect(() =>
      compileDesktopWireSchema(z.object({ id: z.string() }).passthrough(), CONTEXT),
    ).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "DESKTOP_WIRE_SCHEMA_DYNAMIC_OBJECT" })],
      }),
    );
    expect(() =>
      compileDesktopWireSchema(z.object({ id: z.string() }).catchall(z.string()), CONTEXT),
    ).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "DESKTOP_WIRE_SCHEMA_DYNAMIC_OBJECT" })],
      }),
    );

    const optionalSchema = z.object({ id: z.string().optional() });
    expect(parseDesktopWireValue(optionalSchema, {}, CONTEXT)).toEqual({});
    expect(() => parseDesktopWireValue(optionalSchema, { id: undefined }, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );

    const symbolKey = Symbol("secret");
    expect(() =>
      parseDesktopWireValue(optionalSchema, { [symbolKey]: "hidden" }, CONTEXT),
    ).toThrowError(expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }));

    const accessor = Object.defineProperty({}, "id", {
      enumerable: true,
      get: () => "side-effect",
    });
    expect(() => parseDesktopWireValue(optionalSchema, accessor, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
  });

  it("rejects sparse arrays and arrays with custom keys", () => {
    const schema = z.array(z.string().optional());
    const sparse: (string | undefined)[] = [];
    sparse.length = 1;
    const extended = ["one"] as string[] & { extra?: string };
    extended.extra = "hidden";
    class DesktopArray extends Array<string> {}
    const subclass = new DesktopArray();
    subclass.push("one");
    const accessor = Object.defineProperty([], "0", {
      enumerable: true,
      get: () => "side-effect",
    });

    expect(() => parseDesktopWireValue(schema, sparse, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
    expect(() => parseDesktopWireValue(schema, extended, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
    expect(() => parseDesktopWireValue(schema, subclass, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
    expect(() => parseDesktopWireValue(schema, accessor, CONTEXT)).toThrowError(
      expect.objectContaining({ code: "DESKTOP_WIRE_VALUE_INVALID" }),
    );
  });

  it("preserves the exact branch accepted by structural union validation", () => {
    const schema = z.union([
      z.object({ id: z.string() }),
      z.object({ id: z.string(), detail: z.string() }),
    ]);
    const value = { id: "one", detail: "preserved" };

    expect(parseDesktopWireValue(schema, value, CONTEXT)).toBe(value);
    expect(parseDesktopWireValue(schema, value, CONTEXT)).toEqual({
      id: "one",
      detail: "preserved",
    });
  });

  it("rejects non-finite runtime numbers", () => {
    expect(() => parseDesktopWireValue(z.number(), Number.NaN, CONTEXT)).toThrowError(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "DESKTOP_WIRE_VALUE_INVALID",
            message: "Expected a finite DesktopWire number.",
          }),
        ],
      }),
    );
  });
});
