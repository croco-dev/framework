import { describe, expect, it } from "vitest";
import { createTaskDispatcherConformanceSuite } from "../libs/taskDispatcherConformance";

describe("TaskDispatcher conformance oracle", () => {
  it("rejects a false success receipt and a publisher that accepts empty task identities", async () => {
    const suite = createTaskDispatcherConformanceSuite({
      createHarness: () => ({
        dispatcher: { execute: async () => ({ messageId: "" }) },
        messages: [],
      }),
    });
    for (const item of suite.cases) await expect(item.run()).rejects.toBeDefined();
  });
});
