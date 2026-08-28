import { describe, expect, it } from "vitest";

import { parseBenchmarkBaseline } from "../../packages/protocols-desktop/type-fixtures/benchmark.mts";

const validBaseline = {
  schema: "croco.protocols-desktop.type-benchmark.v1",
  fixture: { commands: 200, windows: 20 },
  baseline: { compileTimeMs: 1_000, instantiations: 300_000, peakMemoryKiB: 350_000 },
  thresholds: { compileTimeRatio: 2.5, instantiationsRatio: 1.25, peakMemoryRatio: 1.75 },
  rationale: "Separate thresholds account for runner and compiler variance.",
};

describe("protocols desktop type benchmark", () => {
  it("accepts a complete finite baseline", () => {
    expect(parseBenchmarkBaseline(validBaseline)).toEqual(validBaseline);
  });

  it("rejects missing metrics instead of creating a vacuous NaN limit", () => {
    const { instantiations: _instantiations, ...incompleteMetrics } = validBaseline.baseline;

    expect(() => parseBenchmarkBaseline({ ...validBaseline, baseline: incompleteMetrics })).toThrow(
      "instantiation baseline must be a finite positive number",
    );
  });

  it("rejects wrong-type and non-positive thresholds", () => {
    expect(() =>
      parseBenchmarkBaseline({
        ...validBaseline,
        thresholds: { ...validBaseline.thresholds, compileTimeRatio: "2.5" },
      }),
    ).toThrow("compileTimeRatio threshold must be a finite positive number");
    expect(() =>
      parseBenchmarkBaseline({
        ...validBaseline,
        thresholds: { ...validBaseline.thresholds, peakMemoryRatio: 0 },
      }),
    ).toThrow("peakMemoryRatio threshold must be a finite positive number");
  });

  it("rejects schema and synthetic fixture drift", () => {
    expect(() => parseBenchmarkBaseline({ ...validBaseline, schema: "legacy" })).toThrow(
      "benchmark baseline has an unsupported schema",
    );
    expect(() =>
      parseBenchmarkBaseline({ ...validBaseline, fixture: { commands: 199, windows: 20 } }),
    ).toThrow("benchmark fixture must describe exactly 200 commands and 20 windows");
  });
});
