import { ReminderInvalidProblem, EngagementPersistenceProblem } from "@croco/engagement-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzleReminderStore, type DrizzleReminderClient } from "../index";

describe("DrizzleReminderStore", () => {
  it("rejects missing scope identity before opening a transaction", async () => {
    const transaction = vi.fn();
    const store = new DrizzleReminderStore({ transaction } as unknown as DrizzleReminderClient);
    await expect(
      store.transact({ app: "", environment: "test", tenantId: "tenant" }, "user", async () => {}),
    ).rejects.toThrow(ReminderInvalidProblem);
    expect(transaction).not.toHaveBeenCalled();
  });
  it("wraps database errors while preserving domain problems", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new ReminderInvalidProblem("invalid"));
    const store = new DrizzleReminderStore({ transaction } as unknown as DrizzleReminderClient);
    const scope = { app: "app", environment: "test", tenantId: "tenant" };
    await expect(store.transact(scope, "user", async () => {})).rejects.toThrow(
      EngagementPersistenceProblem,
    );
    await expect(store.transact(scope, "user", async () => {})).rejects.toThrow(
      ReminderInvalidProblem,
    );
  });
});
