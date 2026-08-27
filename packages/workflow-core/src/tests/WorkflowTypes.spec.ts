import { describe, expect, expectTypeOf, it } from "vitest";
import { taskRef } from "@croco/tasks-core";
import { defineWorkflow } from "../libs/defineWorkflow";
import type { WorkflowRunner } from "../libs/WorkflowRunner";

type WorkflowPayload = {
  readonly subscriptionId: string;
};

class BillingTasks {
  fetchSubscription(payload: WorkflowPayload): {
    readonly subscriptionId: string;
    readonly plan: string;
  } {
    return { subscriptionId: payload.subscriptionId, plan: "pro" };
  }

  async syncEntitlements(payload: {
    readonly subscriptionId: string;
    readonly plan: string;
  }): Promise<{ readonly synchronized: string }> {
    return { synchronized: payload.subscriptionId };
  }
}

const FETCH_SUBSCRIPTION = taskRef(BillingTasks, "fetchSubscription", "billing.fetch-subscription");
const SYNC_ENTITLEMENTS = taskRef(BillingTasks, "syncEntitlements", "billing.sync-entitlements");

type ExpectedSteps = readonly [
  {
    readonly step: "billing.fetch-subscription";
    readonly task: "billing.fetch-subscription";
    readonly result: {
      readonly subscriptionId: string;
      readonly plan: string;
    };
  },
  {
    readonly step: "sync";
    readonly task: "billing.sync-entitlements";
    readonly result: { readonly synchronized: string };
  },
];

const BILLING_WORKFLOW = defineWorkflow<WorkflowPayload>({
  name: "billing.synchronize",
  idempotencyKey: ({ payload }) => {
    expectTypeOf(payload).toEqualTypeOf<WorkflowPayload>();
    return `billing:${payload.subscriptionId}`;
  },
})
  .step(FETCH_SUBSCRIPTION)
  .step("sync", SYNC_ENTITLEMENTS, ({ payload, previousResults }) => {
    expectTypeOf(payload).toEqualTypeOf<WorkflowPayload>();
    expectTypeOf(previousResults).toEqualTypeOf<
      readonly [
        {
          readonly step: "billing.fetch-subscription";
          readonly task: "billing.fetch-subscription";
          readonly result: {
            readonly subscriptionId: string;
            readonly plan: string;
          };
        },
      ]
    >();
    return previousResults[0].result;
  })
  .build();

function assertRunnerInference(runner: WorkflowRunner): void {
  const run = runner.execute(BILLING_WORKFLOW, { subscriptionId: "sub_123" });
  const legacyRun = runner.execute("billing.legacy", { arbitrary: true });

  void run.then((result) => {
    if (!result.reused) {
      expectTypeOf(result.steps).toEqualTypeOf<ExpectedSteps>();
      expectTypeOf(result.result).toEqualTypeOf<{
        readonly workflowName: string;
        readonly steps: ExpectedSteps;
      }>();
    } else {
      expectTypeOf(result.steps).toEqualTypeOf<readonly []>();
      expectTypeOf(result.result).toEqualTypeOf<unknown>();
    }
  });

  void legacyRun.then((result) => {
    expectTypeOf(result.result).toEqualTypeOf<unknown>();
  });
}

function negativeTypeFixtures(): void {
  defineWorkflow<WorkflowPayload>({ name: "billing.missing-input" })
    // @ts-expect-error workflow payload cannot be passed directly to this task
    .step(SYNC_ENTITLEMENTS);

  defineWorkflow<WorkflowPayload>({ name: "billing.invalid" })
    .step(FETCH_SUBSCRIPTION)
    // @ts-expect-error resolver output must match the referenced task payload
    .step(SYNC_ENTITLEMENTS, () => ({ subscriptionId: 42 }));

  const runner = null as unknown as WorkflowRunner;
  const widePayload: { readonly subscriptionId: string | number } = { subscriptionId: 42 };
  // @ts-expect-error workflow payload must match the typed definition
  void runner.execute(BILLING_WORKFLOW, { subscriptionId: 42 });
  // @ts-expect-error payload inference must not widen the workflow contract
  void runner.execute(BILLING_WORKFLOW, widePayload);
}

describe("typed workflow definitions", () => {
  it("preserves stable runtime task names", () => {
    expect(BILLING_WORKFLOW.steps).toEqual([
      { name: "billing.fetch-subscription", task: FETCH_SUBSCRIPTION },
      { name: "sync", task: SYNC_ENTITLEMENTS, input: expect.any(Function) },
    ]);
    expectTypeOf(assertRunnerInference).toBeFunction();
    expectTypeOf(negativeTypeFixtures).toBeFunction();
  });
});
