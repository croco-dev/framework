import { createProviderNoCredentialConformanceSuite } from "@croco/testing";
import { describe, it, vi } from "vitest";
import { R2StorageDiagnosticsProvider } from "../libs/R2StorageDiagnosticsProvider";

const ACCESS_KEY_SAMPLE = "r2-access-key-sample";
const SECRET_KEY_SAMPLE = "r2-secret-key-sample";

describe("R2 provider no-credential conformance", () => {
  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "storage-r2",
    secretSamples: [ACCESS_KEY_SAMPLE, SECRET_KEY_SAMPLE],
    scenarios: [
      {
        name: "missing bucket",
        diagnosticTokens: ["R2_BUCKET"],
        expectedCode: "STORAGE_R2_MISSING_CONFIG",
        missingEnvironment: ["R2_BUCKET"],
        run: async () => {
          const readinessCheck = vi.fn();
          const health = await new R2StorageDiagnosticsProvider(
            {
              accountId: "r2-account-sample",
              accessKeyId: ACCESS_KEY_SAMPLE,
              secretAccessKey: SECRET_KEY_SAMPLE,
              bucket: process.env.R2_BUCKET,
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
