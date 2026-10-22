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

describe("numeric and array constraints in supported containers", () => {
  it.each([
    { name: "record", wrap: (schema: z.ZodType) => z.record(schema), witness: { item: 7 } },
    { name: "brand", wrap: (schema: z.ZodType) => schema.brand<"Value">(), witness: 7 },
    { name: "readonly", wrap: (schema: z.ZodType) => schema.readonly(), witness: 7 },
    {
      name: "union",
      wrap: (schema: z.ZodType) => z.union([schema, z.literal("unset")]),
      witness: 7,
    },
    {
      name: "readonly array element",
      wrap: (schema: z.ZodType) => z.array(schema.readonly()),
      witness: [7],
    },
    {
      name: "record array element",
      wrap: (schema: z.ZodType) => z.record(z.array(schema)),
      witness: { item: [7] },
    },
  ])("should preserve variance inside $name", ({ wrap, witness }) => {
    const before = wrap(z.number().min(10));
    const after = wrap(z.number().min(5));
    expect(before.safeParse(witness).success).toBe(false);
    expect(after.safeParse(witness).success).toBe(true);
    for (const direction of ["request", "response"] as const) {
      const baseline = loaded(before, direction);
      const current = loaded(after, direction);
      expect(diffContractGraphSnapshots(baseline, current).hasBreakingChanges).toBe(
        direction === "response",
      );
      expect(diffContractGraphSnapshots(current, baseline).hasBreakingChanges).toBe(
        direction === "request",
      );
    }
  });

  it("should compare cardinality restrictions in record values", () => {
    const before = z.record(z.array(z.number()).max(2));
    const after = z.record(z.array(z.number()).max(4));
    expect(before.safeParse({ item: [1, 2, 3] }).success).toBe(false);
    expect(after.safeParse({ item: [1, 2, 3] }).success).toBe(true);
    for (const direction of ["request", "response"] as const) {
      expect(
        diffContractGraphSnapshots(loaded(before, direction), loaded(after, direction))
          .hasBreakingChanges,
      ).toBe(direction === "response");
    }
  });

  it("should compare union branch additions and removals directionally", () => {
    const before = z.number().min(10);
    const after = z.union([before, z.literal("unset")]);
    expect(before.safeParse("unset").success).toBe(false);
    expect(after.safeParse("unset").success).toBe(true);
    for (const direction of ["request", "response"] as const) {
      const baseline = loaded(before, direction);
      const current = loaded(after, direction);
      expect(diffContractGraphSnapshots(baseline, current).hasBreakingChanges).toBe(
        direction === "response",
      );
      expect(diffContractGraphSnapshots(current, baseline).hasBreakingChanges).toBe(
        direction === "request",
      );
    }
  });

  it("should preserve variance inside matching catch wrappers", () => {
    const before = z.number().min(10).catch(10);
    const after = z.number().min(5).catch(10);
    expect(before.parse(7)).toBe(10);
    expect(after.parse(7)).toBe(7);
    for (const direction of ["request", "response"] as const) {
      expect(
        diffContractGraphSnapshots(loaded(before, direction), loaded(after, direction))
          .hasBreakingChanges,
      ).toBe(direction === "response");
    }
  });

  it("should ignore unreachable element restrictions when only the empty array is allowed", () => {
    const before = z.array(z.number()).max(0);
    const after = z.array(z.number().int()).length(0);
    for (const schema of [before, after]) {
      expect(schema.safeParse([]).success).toBe(true);
      expect(schema.safeParse([1]).success).toBe(false);
      expect(schema.safeParse([1.5]).success).toBe(false);
    }
    for (const direction of ["request", "response"] as const) {
      const baseline = loaded(before, direction);
      const current = loaded(after, direction);
      expect(diffContractGraphSnapshots(baseline, current).hasBreakingChanges).toBe(false);
      expect(diffContractGraphSnapshots(current, baseline).hasBreakingChanges).toBe(false);
    }
  });

  it("should treat contradictory array cardinalities as empty value sets", () => {
    const empty = z.array(z.number()).min(2).max(1);
    const alsoEmpty = z.array(z.number().int()).length(0).min(1);
    const available = z.array(z.number());
    for (const value of [[], [1], [1, 2]]) {
      expect(empty.safeParse(value).success).toBe(false);
      expect(alsoEmpty.safeParse(value).success).toBe(false);
      expect(available.safeParse(value).success).toBe(true);
    }
    for (const direction of ["request", "response"] as const) {
      expect(
        diffContractGraphSnapshots(loaded(empty, direction), loaded(alsoEmpty, direction))
          .hasBreakingChanges,
      ).toBe(false);
      expect(
        diffContractGraphSnapshots(loaded(empty, direction), loaded(available, direction))
          .hasBreakingChanges,
      ).toBe(direction === "response");
      expect(
        diffContractGraphSnapshots(loaded(available, direction), loaded(empty, direction))
          .hasBreakingChanges,
      ).toBe(direction === "request");
    }
  });
});

describe("representable integer boundaries", () => {
  it.each([
    [
      z
        .number()
        .int()
        .gt(2 ** 54 - 2),
      z
        .number()
        .int()
        .min(2 ** 54),
      [2 ** 54 - 2, 2 ** 54, 2 ** 55],
    ],
    [
      z
        .number()
        .int()
        .lt(-(2 ** 54) + 2),
      z
        .number()
        .int()
        .max(-(2 ** 54)),
      [-(2 ** 54) + 2, -(2 ** 54), -(2 ** 55)],
    ],
    [
      z
        .number()
        .int()
        .gt(2 ** 53),
      z
        .number()
        .int()
        .min(2 ** 53 + 2),
      [2 ** 53, 2 ** 53 + 2, 2 ** 54],
    ],
    [
      z
        .number()
        .int()
        .lt(-(2 ** 53)),
      z
        .number()
        .int()
        .max(-(2 ** 53) - 2),
      [-(2 ** 53), -(2 ** 53) - 2, -(2 ** 54)],
    ],
    [
      z
        .number()
        .int()
        .gt(-(2 ** 54)),
      z
        .number()
        .int()
        .min(-(2 ** 54) + 2),
      [-(2 ** 54), -(2 ** 54) + 2, 0],
    ],
    [
      z
        .number()
        .int()
        .lt(2 ** 54),
      z
        .number()
        .int()
        .max(2 ** 54 - 2),
      [2 ** 54, 2 ** 54 - 2, 0],
    ],
  ])(
    "should preserve equivalent exclusive and inclusive integer sets %#",
    (before, after, values) => {
      expect(before.safeParse(values[0]).success).toBe(false);
      expect(after.safeParse(values[0]).success).toBe(false);
      for (const value of values.slice(1)) {
        expect(before.safeParse(value).success).toBe(true);
        expect(after.safeParse(value).success).toBe(true);
      }
      for (const direction of ["request", "response"] as const) {
        const baseline = loaded(before, direction);
        const current = loaded(after, direction);
        expect(diffContractGraphSnapshots(baseline, current).hasBreakingChanges).toBe(false);
        expect(diffContractGraphSnapshots(current, baseline).hasBreakingChanges).toBe(false);
      }
    },
  );

  it.each([z.number().int().gt(Number.MAX_VALUE), z.number().int().lt(-Number.MAX_VALUE)])(
    "should treat an exclusive bound beyond finite numbers as empty %#",
    (empty) => {
      const alsoEmpty = z.number().min(1).max(0);
      for (const value of [-Number.MAX_VALUE, 0, Number.MAX_VALUE]) {
        expect(empty.safeParse(value).success).toBe(false);
        expect(alsoEmpty.safeParse(value).success).toBe(false);
      }
      for (const direction of ["request", "response"] as const) {
        expect(
          diffContractGraphSnapshots(loaded(empty, direction), loaded(alsoEmpty, direction))
            .hasBreakingChanges,
        ).toBe(false);
      }
    },
  );
});

describe("finite numeric domain equivalence", () => {
  it.each([
    [
      z.number().int(),
      z.number().int().max(Number.MAX_VALUE),
      [0, Number.MAX_VALUE],
      [Infinity, 0.5],
    ],
    [
      z.number().int(),
      z.number().int().min(-Number.MAX_VALUE),
      [0, -Number.MAX_VALUE],
      [-Infinity, 0.5],
    ],
    [
      z.number().finite(),
      z.number().finite().max(Number.MAX_VALUE),
      [0.5, Number.MAX_VALUE],
      [Infinity],
    ],
    [
      z.number().finite(),
      z.number().finite().min(-Number.MAX_VALUE),
      [-0.5, -Number.MAX_VALUE],
      [-Infinity],
    ],
    [
      z.number().finite().gt(1),
      z
        .number()
        .finite()
        .min(1 + Number.EPSILON),
      [1 + Number.EPSILON, 2],
      [1],
    ],
    [
      z.number().finite().lt(-1),
      z
        .number()
        .finite()
        .max(-1 - Number.EPSILON),
      [-1 - Number.EPSILON, -2],
      [-1],
    ],
    [
      z.number().finite().gt(0),
      z.number().finite().min(Number.MIN_VALUE),
      [Number.MIN_VALUE, 1],
      [0, -Number.MIN_VALUE],
    ],
    [
      z.number().finite().lt(0),
      z.number().finite().max(-Number.MIN_VALUE),
      [-Number.MIN_VALUE, -1],
      [0, Number.MIN_VALUE],
    ],
    [
      z
        .number()
        .finite()
        .min(2 ** 52),
      z
        .number()
        .int()
        .min(2 ** 52),
      [2 ** 52, Number.MAX_VALUE],
      [2 ** 52 - 0.5],
    ],
    [
      z
        .number()
        .finite()
        .max(-(2 ** 52)),
      z
        .number()
        .int()
        .max(-(2 ** 52)),
      [-(2 ** 52), -Number.MAX_VALUE],
      [-(2 ** 52) + 0.5],
    ],
    [
      z.number().finite().gt(Number.MAX_VALUE),
      z.number().min(1).max(0),
      [],
      [-Number.MAX_VALUE, 0, Number.MAX_VALUE, Infinity],
    ],
    [
      z.number().finite().lt(-Number.MAX_VALUE),
      z.number().min(1).max(0),
      [],
      [-Number.MAX_VALUE, 0, Number.MAX_VALUE, -Infinity],
    ],
  ])("should preserve equivalent finite numeric sets %#", (before, after, accepted, rejected) => {
    for (const value of accepted) {
      expect(before.safeParse(value).success).toBe(true);
      expect(after.safeParse(value).success).toBe(true);
    }
    for (const value of rejected) {
      expect(before.safeParse(value).success).toBe(false);
      expect(after.safeParse(value).success).toBe(false);
    }
    for (const direction of ["request", "response"] as const) {
      const baseline = loaded(before, direction);
      const current = loaded(after, direction);
      expect(diffContractGraphSnapshots(baseline, current).hasBreakingChanges).toBe(false);
      expect(diffContractGraphSnapshots(current, baseline).hasBreakingChanges).toBe(false);
    }
  });
});
