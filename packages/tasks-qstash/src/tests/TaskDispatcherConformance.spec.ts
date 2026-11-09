import { describe, it, vi } from "vitest";
import { createTaskDispatcherConformanceSuite } from "@croco/testing";

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = publish;
  },
}));
import { QStashTaskRunner } from "../index";

describe("QStash TaskDispatcher conformance", () => {
  const suite = createTaskDispatcherConformanceSuite({
    createHarness: () => {
      const messages: { taskId: string; payload: unknown }[] = [];
      publish.mockImplementation(async ({ body }) => {
        messages.push(body);
        return { messageId: "accepted" };
      });
      return {
        dispatcher: new QStashTaskRunner({
          token: "fixture",
          destinationUrl: "https://example.test/tasks",
        }),
        messages,
      };
    },
  });
  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
