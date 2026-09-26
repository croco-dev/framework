import { describe, expect, it } from "vitest";
import { createTelemetryConfig, readEnv } from "../env";

describe("createTelemetryConfig", () => {
  it("enables tracing without overriding SDK resolution of a generic OTLP endpoint", () => {
    const config = createTelemetryConfig(
      readEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318/base" }),
    );

    expect(config.enabled).toBe(true);
    expect(config.trace?.enabled).toBe(true);
    expect(config.trace?.exporterUrl).toBeUndefined();
  });

  it("preserves an explicit trace endpoint when a generic endpoint is also set", () => {
    const config = createTelemetryConfig(
      readEnv({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318/base",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: " http://traces:4318/custom ",
      }),
    );

    expect(config.enabled).toBe(true);
    expect(config.trace?.enabled).toBe(true);
    expect(config.trace?.exporterUrl).toBe("http://traces:4318/custom");
  });

  it("does not let a blank trace endpoint mask a configured generic endpoint", () => {
    const config = createTelemetryConfig(
      readEnv({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: " ",
      }),
    );

    expect(config.enabled).toBe(true);
    expect(config.trace?.enabled).toBe(true);
    expect(config.trace?.exporterUrl).toBeUndefined();
  });

  it("keeps telemetry disabled when both endpoint variables are blank", () => {
    const config = createTelemetryConfig(
      readEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: " ", OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: " " }),
    );

    expect(config.enabled).toBe(false);
    expect(config.trace?.enabled).toBe(false);
    expect(config.trace?.exporterUrl).toBeUndefined();
  });

  it("allows telemetry to be enabled explicitly without an endpoint override", () => {
    const config = createTelemetryConfig(readEnv({ TELEMETRY_ENABLED: "true" }));

    expect(config.enabled).toBe(true);
    expect(config.trace?.enabled).toBe(true);
    expect(config.trace?.exporterUrl).toBeUndefined();
  });
});
