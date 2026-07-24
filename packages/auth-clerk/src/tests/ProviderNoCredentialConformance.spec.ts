import { createProviderNoCredentialConformanceSuite } from "@croco/testing";
import { describe, it, vi } from "vitest";
import { ClerkAuthDiagnosticsProvider } from "../libs/ClerkAuthDiagnosticsProvider";

const SECRET_SAMPLE = "clerk-webhook-secret-sample";

describe("Clerk provider no-credential conformance", () => {
  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "auth-clerk",
    secretSamples: [SECRET_SAMPLE],
    scenarios: [
      {
        name: "missing secret key",
        diagnosticTokens: ["CLERK_SECRET_KEY"],
        expectedCode: "auth-clerk/missing-config",
        missingEnvironment: ["CLERK_SECRET_KEY"],
        run: async () => {
          const readinessCheck = vi.fn();
          const health = await new ClerkAuthDiagnosticsProvider(
            {
              publishableKey: "pk_test_no_credential",
              secretKey: process.env.CLERK_SECRET_KEY,
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
