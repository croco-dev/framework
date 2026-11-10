import { describe, it } from "vitest";
import {
  createProviderNoCredentialConformanceSuite,
  createTaskDispatcherConformanceSuite,
} from "@croco/testing";
import { Problem } from "@croco/problems-core";
import { SqsTaskDispatcher } from "../index";

describe("SQS TaskDispatcher conformance", () => {
  const suite = createTaskDispatcherConformanceSuite({
    createHarness: () => {
      const messages: { taskId: string; payload: unknown }[] = [];
      const dispatcher = new SqsTaskDispatcher({
        queueUrl: "https://sqs.ap-northeast-2.amazonaws.com/123456789012/tasks",
        region: "ap-northeast-2",
        tenantId: "tenant-a",
        client: {
          send: async (command) => {
            const { taskId, payload } = JSON.parse(command.input.MessageBody ?? "{}");
            messages.push({ taskId, payload });
            return { MessageId: "accepted", $metadata: {} };
          },
        },
      });
      return { dispatcher, messages };
    },
  });
  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});

describe("SQS no-credential conformance", () => {
  const suite = createProviderNoCredentialConformanceSuite({
    providerName: "tasks-sqs",
    secretSamples: ["fixture-secret"],
    scenarios: [
      {
        name: "missing region",
        missingEnvironment: ["AWS_REGION"],
        expectedCode: "tasks-sqs/invalid-configuration",
        diagnosticTokens: ["region"],
        run: () => {
          let attempts = 0;
          try {
            new SqsTaskDispatcher({
              queueUrl: "https://example.test/tasks",
              region: "",
              tenantId: "tenant-a",
              client: {
                send: async () => {
                  attempts++;
                  throw new Error("fixture-secret");
                },
              },
            });
          } catch (error) {
            if (error instanceof Problem)
              return {
                diagnostic: { code: error.code, message: error.message, details: error.extensions },
                networkAttempts: attempts,
              };
            throw error;
          }
          throw new TypeError("Expected configuration rejection");
        },
      },
    ],
  });
  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
