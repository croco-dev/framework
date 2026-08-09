import { describe, expect, it } from "vitest";
import { TelemetryAutoInstrumentationProblem } from "../libs/problems/TelemetryAutoInstrumentationProblem";
import {
  LegacyTelemetrySignalConfigProblem,
  OtlpEndpointRequiredProblem,
  SamplerProblem,
  TelemetryBatchConfigurationProblem,
  TelemetryForceFlushUnsupportedProblem,
  TelemetryRuntimeProblem,
} from "../libs/problems/TelemetryProblems";

describe("TelemetryBatchConfigurationProblem", () => {
  it("exposes stable field context without a non-finite JSON number", () => {
    const problem = new TelemetryBatchConfigurationProblem(
      "batchCount",
      "positive-int32",
      Number.POSITIVE_INFINITY,
    );

    expect(problem).toMatchObject({
      category: "InternalServerError",
      code: "telemetry-sdk-node/batch-configuration-invalid",
      constraint: "positive-int32",
      field: "batchCount",
      receivedValue: "Infinity",
    });
    expect(problem.toJSON()).toMatchObject({
      constraint: "positive-int32",
      field: "batchCount",
      receivedValue: "Infinity",
    });
  });
});

describe("SamplerProblem", () => {
  it("should set detail correctly", () => {
    const problem = new SamplerProblem("Probability must be between 0 and 1");
    expect(problem.detail).toBe("Probability must be between 0 and 1");
  });

  it("should set code correctly", () => {
    const problem = new SamplerProblem("test");
    expect(problem.code).toBe("TELEMETRY_SAMPLER_INVALID_CONFIG");
  });

  it("should include detail in toJSON()", () => {
    const problem = new SamplerProblem("invalid config");
    const json = problem.toJSON();
    expect(json.detail).toBe("invalid config");
  });

  it("should include code in toJSON()", () => {
    const problem = new SamplerProblem("test");
    const json = problem.toJSON();
    expect(json.code).toBe("TELEMETRY_SAMPLER_INVALID_CONFIG");
  });
});

describe("TelemetryAutoInstrumentationProblem", () => {
  it("exposes stable validation evidence without configuration values", () => {
    const problem = new TelemetryAutoInstrumentationProblem("Operation filters are unsupported");

    expect(problem.code).toBe("TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG");
    expect(problem.detail).toBe("Operation filters are unsupported");
    expect(problem.toJSON()).toMatchObject({
      code: "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG",
      detail: "Operation filters are unsupported",
    });
  });
});

describe("OtlpEndpointRequiredProblem", () => {
  it("should set detail correctly", () => {
    const problem = new OtlpEndpointRequiredProblem();
    expect(problem.detail).toBe("OTLP endpoint is required for telemetry");
  });

  it("should set code correctly", () => {
    const problem = new OtlpEndpointRequiredProblem();
    expect(problem.code).toBe("OTLP_ENDPOINT_REQUIRED");
  });

  it("should include detail in toJSON()", () => {
    const problem = new OtlpEndpointRequiredProblem();
    const json = problem.toJSON();
    expect(json.detail).toBe("OTLP endpoint is required for telemetry");
  });
});

describe("TelemetryRuntimeProblem", () => {
  it("should set detail correctly for init phase", () => {
    const problem = new TelemetryRuntimeProblem("init", new Error("connection failed"));
    expect(problem.detail).toBe("Telemetry init failed: connection failed");
  });

  it("should set detail correctly for forceFlush phase", () => {
    const problem = new TelemetryRuntimeProblem("forceFlush", new Error("timeout"));
    expect(problem.detail).toBe("Telemetry forceFlush failed: timeout");
  });

  it("should set detail correctly for shutdown phase", () => {
    const problem = new TelemetryRuntimeProblem("shutdown", new Error("cleanup failed"));
    expect(problem.detail).toBe("Telemetry shutdown failed: cleanup failed");
  });

  it("should set code correctly", () => {
    const problem = new TelemetryRuntimeProblem("init", new Error("test"));
    expect(problem.code).toBe("TELEMETRY_RUNTIME_ERROR");
  });

  it("should include detail in toJSON()", () => {
    const problem = new TelemetryRuntimeProblem("init", new Error("test error"));
    const json = problem.toJSON();
    expect(json.detail).toBe("Telemetry init failed: test error");
  });

  it("should handle non-Error cause", () => {
    const problem = new TelemetryRuntimeProblem("init", "string error");
    expect(problem.detail).toBe("Telemetry init failed: string error");
  });

  it("should preserve cause in toJSON()", () => {
    const cause = new Error("root cause");
    const problem = new TelemetryRuntimeProblem("init", cause);
    expect(problem.cause).toBe(cause);
  });
});

describe("TelemetryForceFlushUnsupportedProblem", () => {
  it("should expose stable unsupported lifecycle evidence", () => {
    const problem = new TelemetryForceFlushUnsupportedProblem();

    expect(problem).toMatchObject({
      code: "TELEMETRY_FORCE_FLUSH_UNSUPPORTED",
      category: "NotImplemented",
      detail: "Telemetry forceFlush is unsupported before initialization.",
    });
    expect(problem.status).toBe(501);
  });
});

describe("LegacyTelemetrySignalConfigProblem", () => {
  it("should direct legacy JavaScript consumers to the trace-only contract", () => {
    const problem = new LegacyTelemetrySignalConfigProblem(["metrics", "logs"]);

    expect(problem).toMatchObject({
      code: "TELEMETRY_SIGNAL_UNSUPPORTED",
      category: "BadRequest",
      signals: ["metrics", "logs"],
    });
    expect(problem.detail).toBe(
      "TelemetryRuntime supports traces only; remove metrics and logs configuration before initialization",
    );
  });
});
