import { describe, expect, expectTypeOf, it } from "vitest";
import { taskRef } from "../libs/taskRef";
import type { TaskReferencePayload, TaskReferenceResult } from "../libs/types";

describe("typed task references", () => {
  it("preserves the task name, payload, and awaited result contract", () => {
    class BillingTasks {
      async synchronize(payload: { readonly subscriptionId: string }): Promise<{
        readonly synchronized: string;
      }> {
        return { synchronized: payload.subscriptionId };
      }

      healthCheck(): { readonly healthy: true } {
        return { healthy: true };
      }
    }

    const reference = taskRef(BillingTasks, "synchronize", "billing.synchronize");
    const noPayloadReference = taskRef(BillingTasks, "healthCheck", "billing.health-check");

    expect(reference).toEqual({
      name: "billing.synchronize",
      target: BillingTasks,
      methodName: "synchronize",
    });
    expectTypeOf(reference.name).toEqualTypeOf<"billing.synchronize">();
    expectTypeOf<TaskReferencePayload<typeof reference>>().toEqualTypeOf<{
      readonly subscriptionId: string;
    }>();
    expectTypeOf<TaskReferenceResult<typeof reference>>().toEqualTypeOf<{
      readonly synchronized: string;
    }>();
    expectTypeOf<TaskReferencePayload<typeof noPayloadReference>>().toEqualTypeOf<unknown>();
  });
});
