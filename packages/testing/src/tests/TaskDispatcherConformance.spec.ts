import * as assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { createTaskDispatcherConformanceSuite } from "../libs/taskDispatcherConformance";

function cases(messageId: string, acceptEmpty = false) {
  const suite = createTaskDispatcherConformanceSuite({
    createHarness: () => {
      const messages: { taskId: string; payload: unknown }[] = [];
      return {
        dispatcher: {
          execute: async (taskId: string, payload: unknown) => {
            if (!acceptEmpty && !taskId.trim()) throw new TypeError("Empty task identity");
            messages.push({ taskId, payload });
            return { messageId };
          },
        },
        messages,
      };
    },
  });
  const [publication, rejection] = suite.cases;
  assert.ok(publication);
  assert.ok(rejection);
  return { publication, rejection };
}

describe("TaskDispatcher conformance oracle", () => {
  it("accepts a publisher with valid receipts and pre-publication identity validation", async () => {
    const { publication, rejection } = cases("accepted-1");
    await expect(publication.run()).resolves.toBeUndefined();
    await expect(rejection.run()).resolves.toBeUndefined();
  });

  it.each(["", "   "])(
    "rejects only publication with an invalid receipt: %j",
    async (messageId) => {
      const { publication, rejection } = cases(messageId);
      await expect(publication.run()).rejects.toBeDefined();
      await expect(rejection.run()).resolves.toBeUndefined();
    },
  );

  it("rejects only identity validation when a publisher accepts empty task identities", async () => {
    const { publication, rejection } = cases("accepted-2", true);
    await expect(publication.run()).resolves.toBeUndefined();
    await expect(rejection.run()).rejects.toBeDefined();
  });
});
