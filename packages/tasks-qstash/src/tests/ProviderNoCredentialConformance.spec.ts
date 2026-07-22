import { Problem } from "@croco/problems-core";
import { createProviderNoCredentialConformanceSuite } from "@croco/testing";
import { describe, it, vi } from "vitest";

const mockPublishJSON = vi.fn();

vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

import { QStashTaskRunner } from "../libs/QStashTaskRunner";

const SECRET_SAMPLE = "qstash-header-secret-sample";

describe("QStash tasks provider no-credential conformance", () => {
  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "tasks-qstash",
    secretSamples: [SECRET_SAMPLE],
    scenarios: [
      {
        name: "missing token",
        diagnosticTokens: ["token"],
        expectedCode: "tasks-qstash/missing-config",
        missingEnvironment: ["UPSTASH_QSTASH_TOKEN"],
        run: () => {
          mockPublishJSON.mockReset();

          try {
            new QStashTaskRunner({
              token: process.env.UPSTASH_QSTASH_TOKEN ?? "",
              destinationUrl: "https://example.test/tasks",
              defaultHeaders: { Authorization: `Bearer ${SECRET_SAMPLE}` },
            });
          } catch (error) {
            if (error instanceof Problem) {
              return {
                diagnostic: {
                  code: error.code,
                  message: error.detail ?? error.message,
                  details: error.extensions,
                },
                networkAttempts: mockPublishJSON.mock.calls.length,
              };
            }
            throw error;
          }

          throw new TypeError("QStashTaskRunner accepted missing token configuration.");
        },
      },
    ],
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
