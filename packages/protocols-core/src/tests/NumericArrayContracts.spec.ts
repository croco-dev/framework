import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildContractGraph } from "../libs/ContractGraph";
import { diffContractGraphSnapshots } from "../libs/ContractGraphDiff";
import {
  createContractGraphSnapshot,
  parseContractGraphSnapshot,
  stringifyContractGraphSnapshot,
} from "../libs/ContractGraphSnapshot";
import { describeZodSchema } from "../libs/SchemaDescriptor";
import { Body, Controller, Post, ResponseSchema } from "./helpers/test-decorators";

function snapshot(schema: z.ZodType, direction: "request" | "response") {
  @Controller("/values")
  class ValuesController {
    @Post("/")
    @ResponseSchema(direction === "response" ? z.object({ value: schema }) : z.boolean())
    create(
      @Body(direction === "request" ? z.object({ value: schema }) : z.object({})) _body: unknown,
    ): void {}
  }
  return createContractGraphSnapshot(buildContractGraph([ValuesController]));
}

function loaded(schema: z.ZodType, direction: "request" | "response") {
  const original = snapshot(schema, direction);
  const parsed = parseContractGraphSnapshot(JSON.parse(stringifyContractGraphSnapshot(original)));
  expect(parsed).toEqual(original);
  if (!parsed) throw new TypeError("Expected a valid persisted contract");
  return parsed;
}

describe("numeric and array snapshot contracts", () => {
  it.each([
    [z.number(), z.number().min(10), 1],
    [z.number(), z.number().int(), 1.5],
    [z.array(z.string()), z.array(z.string()).min(2), []],
  ])(
    "should expose runtime rejection as a persisted request breaking change %#",
    (before, after, input) => {
      expect(before.safeParse(input).success).toBe(true);
      expect(after.safeParse(input).success).toBe(false);
      const baseline = loaded(before, "request");
      const current = loaded(after, "request");
      expect(stringifyContractGraphSnapshot(current)).not.toBe(
        stringifyContractGraphSnapshot(baseline),
      );
      expect(diffContractGraphSnapshots(baseline, current).breakingChanges).toEqual([
        expect.objectContaining({
          code: "contract-request-field-schema-incompatible",
          fieldPath: "value",
          location: "body",
        }),
      ]);
    },
  );

  it.each([
    [z.number(), z.number().min(-3.5), true, false],
    [z.number().min(10), z.number().min(7), false, true],
    [z.number().max(8), z.number().max(13), false, true],
    [z.number().min(3), z.number().gt(3), true, false],
    [z.number().lt(9), z.number().max(9), false, true],
    [z.number().gt(3), z.number().gt(3), false, false],
    [z.number().int(), z.number(), false, true],
    [
      z
        .number()
        .int()
        .min(2 ** 53),
      z
        .number()
        .int()
        .gt(2 ** 53),
      true,
      false,
    ],
    [
      z
        .number()
        .int()
        .max(-(2 ** 53)),
      z
        .number()
        .int()
        .lt(-(2 ** 53)),
      true,
      false,
    ],
    [z.number().min(4).max(4), z.number().int().min(4).max(4), false, false],
    [z.number().gt(4).max(4), z.number(), false, true],
    [z.number().min(3).optional(), z.number().gt(3).optional(), true, false],
    [z.number().int().gt(3), z.number().int().min(4), false, false],
    [z.number().int().min(4), z.number().min(3.5), false, true],
    [z.array(z.string()).min(2), z.array(z.string()).min(1), false, true],
    [z.array(z.string()).max(2), z.array(z.string()).max(4), false, true],
    [z.array(z.string()).length(3), z.array(z.string()).min(3).max(3), false, false],
    [z.array(z.string()), z.array(z.string()).min(0), false, false],
    [z.array(z.string()).min(2), z.array(z.string()), false, true],
    [z.array(z.number()), z.array(z.number().int()), true, false],
    [z.array(z.array(z.number()).max(4)), z.array(z.array(z.number()).max(2)), true, false],
  ])(
    "should apply request and response variance through nested fields %#",
    (before, after, requestBreaking, responseBreaking) => {
      for (const [direction, breaking] of [
        ["request", requestBreaking],
        ["response", responseBreaking],
      ] as const) {
        expect(
          diffContractGraphSnapshots(loaded(before, direction), loaded(after, direction))
            .hasBreakingChanges,
        ).toBe(breaking);
      }
    },
  );

  it("should normalize repeated bounds deterministically and preserve inclusivity", () => {
    const first = z.number().min(-2).gt(3).min(3).max(12).lt(9).int();
    const second = z.number().int().lt(9).max(12).min(3).gt(3).min(-2);
    expect(describeZodSchema(first)).toEqual({
      kind: "number",
      typeName: "ZodNumber",
      jsonSafe: true,
      minimum: 3,
      exclusiveMinimum: true,
      maximum: 9,
      exclusiveMaximum: true,
      integer: true,
    });
    expect(stringifyContractGraphSnapshot(snapshot(first, "request"))).toBe(
      stringifyContractGraphSnapshot(snapshot(second, "request")),
    );
    expect(describeZodSchema(z.array(z.number()).length(3).min(4))).toMatchObject({
      minItems: 4,
      maxItems: 3,
    });
  });

  it.each([
    z.number().multipleOf(3),
    z.number().min(Infinity),
    z.number().max(NaN),
    z.array(z.string()).min(-1),
    z.array(z.string()).max(1.5),
  ])("should diagnose unrepresentable constraints %#", (schema) => {
    expect(describeZodSchema(schema)).toMatchObject({
      jsonSafe: false,
      unsupportedReason: expect.any(String),
    });
    expect(snapshot(schema, "request").diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "contract-schema-json-unsafe" })]),
    );
  });

  it.each([
    { kind: "number", typeName: "ZodNumber", minimum: "3" },
    { kind: "number", typeName: "ZodNumber", maximum: Infinity },
    { kind: "number", typeName: "ZodNumber", integer: "true" },
    { kind: "number", typeName: "ZodNumber", exclusiveMinimum: true },
    { kind: "number", typeName: "ZodNumber", minimum: 3, exclusiveMinimum: 1 },
    { kind: "array", typeName: "ZodArray", minItems: -1 },
    { kind: "array", typeName: "ZodArray", maxItems: 1.5 },
    { kind: "string", typeName: "ZodString", minimum: 3 },
    { kind: "number", typeName: "ZodNumber", minItems: 3 },
    { kind: "number", typeName: "ZodString", minimum: 3 },
  ])("should reject malformed persisted constraints %#", (descriptor) => {
    const original = snapshot(z.number(), "response");
    expect(
      parseContractGraphSnapshot({
        ...original,
        routes: [{ ...original.routes[0], response: { ...descriptor, jsonSafe: true } }],
      }),
    ).toBeNull();
  });

  it.each([
    {
      kind: "number",
      typeName: "ZodNumber",
      minimum: -3.5,
      maximum: 7,
      exclusiveMinimum: true,
      integer: true,
    },
    {
      kind: "array",
      typeName: "ZodArray",
      minItems: 2,
      maxItems: 5,
      element: { kind: "number", typeName: "ZodNumber", minimum: 4 },
    },
  ])("should retain constraints when normalizing historical v1 snapshots %#", (descriptor) => {
    const original = snapshot(z.number(), "response");
    const historical = JSON.parse(
      JSON.stringify(
        { ...original, routes: [{ ...original.routes[0], response: descriptor }] },
        (key, value: unknown) =>
          [
            "consumerCoverage",
            "routeContract",
            "entitlements",
            "jsonSafe",
            "monetization",
          ].includes(key)
            ? undefined
            : value,
      ),
    );
    expect(parseContractGraphSnapshot(historical)?.routes[0]?.response).toMatchObject(descriptor);
  });
});
