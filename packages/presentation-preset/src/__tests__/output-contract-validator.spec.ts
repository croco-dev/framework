import { describe, expect, it } from "vitest";

import type { OutputContract } from "../output-contract";
import { OutputContractValidator } from "../output-contract-validator";

function createValidContract(overrides?: Partial<OutputContract>): OutputContract {
  return {
    presetName: "node",
    buildTime: "2025-01-01T00:00:00Z",
    format: "dual",
    artifacts: [
      { path: "index.js", format: "esm", type: "code" },
      { path: "index.cjs", format: "cjs", type: "code" },
      { path: "index.d.ts", format: "esm", type: "types" },
      { path: "entry.js", format: "esm", type: "code" },
      { path: "entry.cjs", format: "cjs", type: "code" },
      { path: "entry.d.ts", format: "esm", type: "types" },
    ],
    entries: [
      { exportName: ".", main: "index.js", cjs: "index.cjs", types: "index.d.ts" },
      { exportName: "./entry", main: "entry.js", cjs: "entry.cjs", types: "entry.d.ts" },
    ],
    ...overrides,
  };
}

describe("OutputContractValidator", () => {
  const validator = new OutputContractValidator();

  it("passes a valid contract", () => {
    const report = validator.validate(createValidContract());

    expect(report.passed).toBe(true);
    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
  });

  it("reports error when presetName is missing", () => {
    const contract = createValidContract({ presetName: "" });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
    expect(report.results.some((result) => result.message.includes("presetName"))).toBe(true);
  });

  it("reports warning when artifacts is empty", () => {
    const contract = createValidContract({ artifacts: [] });
    const report = validator.validate(contract);

    expect(report.results.some((result) => result.message.includes("No artifacts"))).toBe(true);
  });

  it("reports error when entries is empty", () => {
    const contract = createValidContract({ entries: [] });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
  });

  it("reports warning when entry references missing artifact", () => {
    const contract = createValidContract({
      artifacts: [{ path: "index.js", format: "esm", type: "code" }],
      entries: [{ exportName: ".", main: "index.js", types: "index.d.ts" }],
    });
    const report = validator.validate(contract);

    expect(
      report.results.some(
        (result) => result.message.includes("index.d.ts") && result.severity === "warning",
      ),
    ).toBe(true);
  });

  it("warns when types file is missing from entry", () => {
    const contract = createValidContract({
      entries: [{ exportName: ".", main: "index.js", types: "" }],
    });
    const report = validator.validate(contract);

    expect(report.results.some((result) => result.message.includes("types"))).toBe(true);
  });

  it("handles empty contract gracefully", () => {
    const report = validator.validate({
      presetName: "",
      buildTime: "",
      format: "esm",
      artifacts: [],
      entries: [],
    });

    expect(report.passed).toBe(false);
    expect(report.results.length).toBeGreaterThan(0);
  });
});
