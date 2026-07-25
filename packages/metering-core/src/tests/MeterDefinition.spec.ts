import { describe, expect, it } from "vitest";
import { defineMeter, dimension, isMeterRef } from "../libs/MeterDefinition";
import { InvalidMeterDefinitionProblem } from "../libs/problems/InvalidMeterDefinitionProblem";

describe("defineMeter", () => {
  it("creates a branded descriptor without function values", () => {
    const meter = defineMeter({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        region: dimension.enum(["ap-northeast-2", "us-east-1"]),
        model: dimension.enum(["gpt-5", "gpt-5-mini"]),
      },
      billing: "required",
    });

    expect(isMeterRef(meter)).toBe(true);
    expect(meter.descriptor).toEqual({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        model: { kind: "enum", values: ["gpt-5", "gpt-5-mini"] },
        region: { kind: "enum", values: ["ap-northeast-2", "us-east-1"] },
      },
      billing: "required",
    });
    expect(JSON.stringify(meter.descriptor)).toBe(
      '{"key":"ai.tokens","aggregation":"SUM","unit":"token","dimensions":{"model":{"kind":"enum","values":["gpt-5","gpt-5-mini"]},"region":{"kind":"enum","values":["ap-northeast-2","us-east-1"]}},"billing":"required"}',
    );
    expect(JSON.stringify(meter.descriptor)).not.toContain("function");
  });

  it("serializes equivalent definitions identically regardless of dimension insertion order", () => {
    const first = defineMeter({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        region: dimension.enum(["ap-northeast-2"]),
        model: dimension.enum(["gpt-5"]),
      },
      billing: "required",
    });
    const second = defineMeter({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        model: dimension.enum(["gpt-5"]),
        region: dimension.enum(["ap-northeast-2"]),
      },
      billing: "required",
    });

    expect(JSON.stringify(first.descriptor)).toBe(JSON.stringify(second.descriptor));
  });

  it("preserves enum tuple order at runtime", () => {
    const meter = defineMeter({
      key: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      dimensions: {
        model: dimension.enum(["z-model", "a-model"]),
      },
      billing: "required",
    });

    expect(meter.descriptor.dimensions.model.values).toEqual(["z-model", "a-model"]);
  });

  it("recognizes only refs issued by defineMeter", () => {
    const meter = defineMeter({
      key: "api.requests",
      aggregation: "COUNT",
      unit: "request",
      dimensions: {},
      billing: "local",
    });
    const copiedRef = Object.create(
      Object.getPrototypeOf(meter),
      Object.getOwnPropertyDescriptors(meter),
    );

    expect(isMeterRef(copiedRef)).toBe(false);
  });

  it("rejects empty and duplicate enum values", () => {
    expect(() => dimension.enum([""])).toThrow(InvalidMeterDefinitionProblem);
    expect(() => dimension.enum(["gpt-5", "gpt-5"])).toThrow(InvalidMeterDefinitionProblem);
  });

  it("rejects malformed definitions from untyped JavaScript callers", () => {
    const defineUnsafe = defineMeter as unknown as (definition: unknown) => unknown;
    const enumUnsafe = dimension.enum as unknown as (values: unknown) => unknown;

    expect(() => defineUnsafe(null)).toThrow(InvalidMeterDefinitionProblem);
    expect(() => enumUnsafe(null)).toThrow(InvalidMeterDefinitionProblem);
    expect(() => enumUnsafe([42])).toThrow(InvalidMeterDefinitionProblem);
    expect(() =>
      defineUnsafe({
        key: 42,
        aggregation: "COUNT",
        unit: "request",
        dimensions: {},
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
    expect(() =>
      defineUnsafe({
        key: "api.requests",
        aggregation: "AVERAGE",
        unit: "request",
        dimensions: {},
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
    expect(() =>
      defineUnsafe({
        key: "api.requests",
        aggregation: "COUNT",
        unit: "request",
        dimensions: null,
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
    expect(() =>
      defineUnsafe({
        key: "api.requests",
        aggregation: "COUNT",
        unit: "request",
        dimensions: { region: { kind: "enum", values: [] } },
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
  });

  it("rejects empty keys and units", () => {
    expect(() =>
      defineMeter({
        key: " ",
        aggregation: "COUNT",
        unit: "request",
        dimensions: {},
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
    expect(() =>
      defineMeter({
        key: "api.requests",
        aggregation: "COUNT",
        unit: "",
        dimensions: {},
        billing: "local",
      }),
    ).toThrow(InvalidMeterDefinitionProblem);
  });
});
