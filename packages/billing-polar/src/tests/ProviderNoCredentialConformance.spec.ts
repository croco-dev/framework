import { describe, it, vi } from "vitest";
import { createProviderNoCredentialConformanceSuite } from "@croco/testing";
import { PolarBillingDiagnosticsProvider } from "../libs/PolarBillingDiagnosticsProvider";

const SECRET_SAMPLE = "polar-webhook-secret-sample";

describe("Polar provider no-credential conformance", () => {
  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "billing-polar",
    secretSamples: [SECRET_SAMPLE],
    scenarios: [
      {
        name: "missing access token",
        diagnosticTokens: ["accessToken"],
        expectedCode: "billing-polar/missing-config",
        missingEnvironment: ["POLAR_ACCESS_TOKEN"],
        run: async () => {
          const readinessCheck = vi.fn();
          const health = await new PolarBillingDiagnosticsProvider(
            {
              accessToken: process.env.POLAR_ACCESS_TOKEN,
              environment: "sandbox",
              webhookSecret: SECRET_SAMPLE,
            },
            { readinessCheck },
          ).getHealth();
          const details = health.details as Record<string, unknown>;

          return {
            diagnostic: {
              code: String(details.problemCode),
              message: health.message ?? "",
              details,
            },
            networkAttempts: readinessCheck.mock.calls.length,
          };
        },
      },
    ],
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
