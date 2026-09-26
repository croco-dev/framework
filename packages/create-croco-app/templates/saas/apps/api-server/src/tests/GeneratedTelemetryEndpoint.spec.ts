import { describe, expect, it, vi } from "vitest";
import type { ILogger } from "@croco/framework-context";
import type { nodeTelemetry as NodeTelemetryFactory } from "@croco/telemetry-sdk-node";
import {
  createGeneratedSaasApplicationDefinition,
  generatedSaasProviderProfileManifest,
} from "../generatedSaasProviderProfile";

const captureTelemetryOptions = vi.hoisted(() => vi.fn());

vi.mock("@croco/telemetry-sdk-node", async (importOriginal) => {
  const actual = await importOriginal<{ nodeTelemetry: typeof NodeTelemetryFactory }>();
  return {
    ...actual,
    nodeTelemetry: (options: Parameters<typeof NodeTelemetryFactory>[0]) => {
      captureTelemetryOptions(options);
      return actual.nodeTelemetry(options);
    },
  };
});

const executableProfileTest = generatedSaasProviderProfileManifest.composition.executable
  ? it
  : it.skip;

describe("generated SaaS telemetry endpoint", () => {
  executableProfileTest.each([
    ["http://collector:4318", undefined, "http://collector:4318/v1/traces"],
    ["http://collector:4318/", "", "http://collector:4318/v1/traces"],
    ["http://collector:4318", "http://traces:4318/custom", "http://traces:4318/custom"],
  ])("resolves generic %s and trace-specific %s", (baseEndpoint, tracesEndpoint, expectedUrl) => {
    captureTelemetryOptions.mockClear();
    createGeneratedSaasApplicationDefinition({
      mode: "production",
      logger: {} as ILogger,
      http: { diValidation: "warn" },
      env: {
        DATABASE_URL: "postgres://localhost:5432/croco",
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
        POLAR_ACCESS_TOKEN: "test-token",
        POLAR_WEBHOOK_SECRET: "test-webhook-secret",
        UPSTASH_QSTASH_TOKEN: "test-token",
        UPSTASH_QSTASH_DESTINATION_URL: "http://localhost:3000/tasks",
        CLOUDINARY_URL: "cloudinary://key:secret@cloud",
        OTEL_EXPORTER_OTLP_ENDPOINT: baseEndpoint,
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: tracesEndpoint,
      },
    });

    expect(captureTelemetryOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        trace: expect.objectContaining({ enabled: true, exporterUrl: expectedUrl }),
      }),
    );
  });
});
