import { describe, expect, it } from "vitest";
import { defineMeter, dimension } from "../libs/MeterRef";
import { InvalidMeterDimensionProblem } from "../libs/problems/InvalidMeterDimensionProblem";

describe("defineMeter", () => {
  it("creates a deterministic function-free descriptor", () => {
    const meter = defineMeter({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        region: dimension.enum(["apac", "emea"]),
        model: dimension.enum(["gpt-5", "gpt-5-mini"]),
      },
      billing: "required",
    });

    expect(JSON.stringify(meter)).toBe(
      '{"key":"ai.tokens","aggregation":"SUM","unit":"token","dimensions":{"model":{"kind":"enum","values":["gpt-5","gpt-5-mini"]},"region":{"kind":"enum","values":["apac","emea"]}},"billing":"required"}',
    );
    expect(Object.values(meter).some((value) => typeof value === "function")).toBe(false);
    expect(Object.isFrozen(meter)).toBe(true);
    expect(Object.isFrozen(meter.dimensions)).toBe(true);
  });

  it("defaults local meters to an empty deterministic dimension schema", () => {
    const meter = defineMeter({
      key: "api.calls",
      aggregation: "COUNT",
      unit: "request",
    });

    expect(meter).toEqual({
      key: "api.calls",
      aggregation: "COUNT",
      unit: "request",
      dimensions: {},
      billing: "local",
    });
  });

  it("orders dimension keys by locale-independent code units", () => {
    const meter = defineMeter({
      key: "api.calls",
      aggregation: "COUNT",
      unit: "request",
      dimensions: {
        ä: dimension.enum(["umlaut"]),
        z: dimension.enum(["ascii"]),
      },
    });

    expect(Object.keys(meter.dimensions)).toEqual(["z", "ä"]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite numeric dimension values: %s",
    (value) => {
      expect(() => dimension.enum([value])).toThrow(InvalidMeterDimensionProblem);
    },
  );

  it("rejects non-finite numeric values from direct dimension descriptors", () => {
    expect(() =>
      defineMeter({
        key: "direct.dimension",
        aggregation: "COUNT",
        unit: "request",
        dimensions: {
          score: { kind: "enum", values: [Number.NaN] as const },
        },
      }),
    ).toThrow(InvalidMeterDimensionProblem);
  });

  it.each([
    { label: "empty array", values: [] },
    { label: "undefined", values: [undefined] },
    { label: "object", values: [{}] },
    { label: "bigint", values: [BigInt(1)] },
    { label: "function", values: [() => "value"] },
  ])("rejects invalid enum values from dimension.enum: $label", ({ values }) => {
    expect(() =>
      dimension.enum(
        values as unknown as readonly [string | number | boolean, ...(string | number | boolean)[]],
      ),
    ).toThrow(InvalidMeterDimensionProblem);
  });

  it.each([
    { kind: "other", values: ["value"] },
    { kind: "enum", values: [] },
    { kind: "enum", values: [undefined] },
    { kind: "enum", values: [{}] },
    { kind: "enum", values: [BigInt(1)] },
  ])("rejects invalid direct dimension descriptors: %s", (descriptor) => {
    expect(() =>
      defineMeter({
        key: "direct.dimension",
        aggregation: "COUNT",
        unit: "request",
        dimensions: {
          invalid: descriptor,
        } as never,
      }),
    ).toThrow(InvalidMeterDimensionProblem);
  });
});
