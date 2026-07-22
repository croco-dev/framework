import { Problem } from "@croco/problems-core";
import { createProviderNoCredentialConformanceSuite } from "@croco/testing";
import { afterEach, describe, it, vi } from "vitest";
import { TelemetryRuntime } from "../runtime";

const SECRET_SAMPLE = "telemetry-exporter-secret-sample";

describe("Telemetry provider no-credential conformance", () => {
  afterEach(async () => {
    await TelemetryRuntime.reset();
    vi.restoreAllMocks();
  });

  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "telemetry-sdk-node",
    secretSamples: [SECRET_SAMPLE],
    scenarios: [
      {
        name: "missing OTLP endpoint",
        diagnosticTokens: ["OTLP endpoint"],
        expectedCode: "OTLP_ENDPOINT_REQUIRED",
        missingEnvironment: ["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT"],
        run: async () => {
          await TelemetryRuntime.reset();
          const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

          try {
            await TelemetryRuntime.getInstance().init({
              serviceName: "no-credential-conformance",
              trace: {
                exporterHeaders: { Authorization: `Bearer ${SECRET_SAMPLE}` },
              },
            });
          } catch (error) {
            if (error instanceof Problem) {
              return {
                diagnostic: {
                  code: error.code,
                  message: error.detail ?? error.message,
                  details: error.extensions,
                },
                networkAttempts: fetchSpy.mock.calls.length,
              };
            }
            throw error;
          } finally {
            fetchSpy.mockRestore();
          }

          throw new TypeError("TelemetryRuntime accepted missing OTLP endpoint configuration.");
        },
      },
    ],
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
