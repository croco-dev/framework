import { describe, expect, it } from "vitest";
import {
  createProviderNoCredentialConformanceSuite,
  type ProviderNoCredentialConformanceOptions,
} from "../libs/provider-no-credential-conformance";

const SECRET_SAMPLE = "provider-secret-sample";

function createSuite(
  overrides: Partial<{
    readonly diagnostic: {
      readonly code: string;
      readonly details?: unknown;
      readonly message: string;
    };
    readonly networkAttempts: number;
  }> = {},
) {
  return createProviderNoCredentialConformanceSuite({
    providerName: "fixture-provider",
    secretSamples: [SECRET_SAMPLE],
    scenarios: [
      {
        name: "missing API token",
        diagnosticTokens: ["FIXTURE_API_TOKEN"],
        expectedCode: "fixture/missing-config",
        missingEnvironment: ["FIXTURE_API_TOKEN"],
        run: () => ({
          diagnostic: overrides.diagnostic ?? {
            code: "fixture/missing-config",
            message: "Set FIXTURE_API_TOKEN before enabling the provider.",
            details: {
              configured: false,
              token: "[redacted]",
            },
          },
          networkAttempts: overrides.networkAttempts ?? 0,
        }),
      },
    ],
  });
}

describe("Provider no-credential conformance", () => {
  it("passes stable diagnostics, network isolation, environment restoration, and redaction", async () => {
    process.env.FIXTURE_API_TOKEN = "ambient-value";
    const suite = createSuite();

    for (const testCase of suite.cases) {
      await testCase.run();
      expect(process.env.FIXTURE_API_TOKEN).toBe("ambient-value");
    }

    delete process.env.FIXTURE_API_TOKEN;
  });

  it("rejects diagnostics that omit actionable configuration evidence", async () => {
    const testCase = createSuite({
      diagnostic: {
        code: "fixture/missing-config",
        message: "Provider configuration is missing.",
      },
    }).cases.find(({ name }) => name.endsWith("reports a stable actionable diagnostic"));

    await expect(testCase?.run()).rejects.toThrow("must identify 'FIXTURE_API_TOKEN'");
  });

  it("rejects vacuous redaction suites without a secret sample", async () => {
    const invalidOptions = {
      providerName: "fixture-provider",
      scenarios: [
        {
          name: "missing API token",
          diagnosticTokens: ["FIXTURE_API_TOKEN"],
          expectedCode: "fixture/missing-config",
          missingEnvironment: ["FIXTURE_API_TOKEN"],
          run: () => ({
            diagnostic: {
              code: "fixture/missing-config",
              message: "Set FIXTURE_API_TOKEN.",
            },
            networkAttempts: 0,
          }),
        },
      ],
    } as unknown as ProviderNoCredentialConformanceOptions;
    const testCase = createProviderNoCredentialConformanceSuite(invalidOptions).cases[0];

    await expect(testCase?.run()).rejects.toThrow("at least one secret sample");
  });

  it("rejects live API attempts before missing configuration is reported", async () => {
    const testCase = createSuite({ networkAttempts: 1 }).cases.find(({ name }) =>
      name.endsWith("makes no live network or API call"),
    );

    await expect(testCase?.run()).rejects.toThrow("before attempting a live network/API call");
  });

  it("rejects diagnostics that leak secret samples", async () => {
    const testCase = createSuite({
      diagnostic: {
        code: "fixture/missing-config",
        message: `Set FIXTURE_API_TOKEN; received ${SECRET_SAMPLE}`,
      },
    }).cases.find(({ name }) => name.endsWith("redacts secret-like configuration values"));

    await expect(testCase?.run()).rejects.toThrow("leaked a configured secret sample");
  });
});
