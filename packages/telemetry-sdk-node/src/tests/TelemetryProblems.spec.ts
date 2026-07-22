import { describe, expect, it } from "vitest";
import { TelemetryAutoInstrumentationProblem } from "../libs/problems/TelemetryAutoInstrumentationProblem";
import {
  OtlpEndpointRequiredProblem,
  SamplerProblem,
  TelemetryForceFlushUnsupportedProblem,
  TelemetryRuntimeProblem,
  UnsupportedTelemetrySignalProblem,
} from "../libs/problems/TelemetryProblems";

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

describe("UnsupportedTelemetrySignalProblem", () => {
  it("should expose stable, actionable signal support evidence without configuration values", () => {
    const problem = new UnsupportedTelemetrySignalProblem(["metrics", "logs"]);

    expect(problem.code).toBe("TELEMETRY_SIGNAL_UNSUPPORTED");
    expect(problem.category).toBe("BadRequest");
    expect(problem.signals).toEqual(["metrics", "logs"]);
    expect(problem.supportState).toBe("unsupported-requested");
    expect(problem.detail).toBe(
      "Telemetry signals 'metrics, logs' are not supported by TelemetryRuntime; set metrics.enabled and logs.enabled to false or omit them until runtime providers are available",
    );
    expect(JSON.stringify(problem)).not.toContain("exporter");
  });
});
