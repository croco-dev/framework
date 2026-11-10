import * as assert from "node:assert/strict";

export type TaskDispatcherConformanceHarness = {
  readonly dispatcher: {
    execute(
      taskId: string,
      payload: unknown,
      options?: { readonly idempotencyKey?: string },
    ): Promise<{ readonly messageId: string }>;
  };
  readonly messages: readonly { readonly taskId: string; readonly payload: unknown }[];
};

/** Common TaskDispatcher behavior independent of provider-specific headers, delay and retry semantics. */
export function createTaskDispatcherConformanceSuite(options: {
  readonly createHarness: () =>
    | TaskDispatcherConformanceHarness
    | Promise<TaskDispatcherConformanceHarness>;
}): { readonly cases: readonly { readonly name: string; run(): Promise<void> }[] } {
  return {
    cases: [
      {
        name: "returns an accepted message identity and preserves the task and payload",
        run: async () => {
          const harness = await options.createHarness();
          const payload = { orderId: "order-71", quantity: 3 };
          const result = await harness.dispatcher.execute("orders.fulfill", payload, {
            idempotencyKey: "order-71",
          });
          assert.equal(typeof result.messageId, "string");
          assert.ok(result.messageId.trim().length > 0);
          assert.deepEqual(harness.messages, [{ taskId: "orders.fulfill", payload }]);
        },
      },
      {
        name: "rejects empty task identities before publishing",
        run: async () => {
          const harness = await options.createHarness();
          for (const taskId of ["", "   "]) {
            await assert.rejects(() => harness.dispatcher.execute(taskId, { orderId: "order-12" }));
          }
          assert.equal(harness.messages.length, 0);
        },
      },
    ],
  };
}
