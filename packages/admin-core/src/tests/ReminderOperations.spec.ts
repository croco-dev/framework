import { describe, expect, it, vi } from "vitest";
import {
  assertReminderOperatorCancel,
  loadReminderOperations,
  ReminderOperationsProblem,
} from "../libs/ReminderOperations";

describe("Reminder operations boundary", () => {
  const command = {
    scope: { app: "app", environment: "test", tenantId: "tenant" },
    subject: "owner",
    id: "reminder",
    expectedVersion: 2,
    actor: "operator",
    reason: "Support request",
    idempotencyKey: "cancel-1",
  };
  it("requires actor, reason, idempotency and CAS evidence", () => {
    expect(() => assertReminderOperatorCancel(command)).not.toThrow();
    for (const field of ["actor", "reason", "idempotencyKey", "subject", "id"] as const)
      expect(() => assertReminderOperatorCancel({ ...command, [field]: "" })).toThrow(
        ReminderOperationsProblem,
      );
    expect(() => assertReminderOperatorCancel({ ...command, expectedVersion: 0 })).toThrow(
      ReminderOperationsProblem,
    );
  });
  it("does not load protected data without permission", async () => {
    const source = { load: vi.fn(), cancel: vi.fn() };
    expect(await loadReminderOperations(source, [])).toMatchObject({ kind: "denied" });
    expect(source.load).not.toHaveBeenCalled();
  });
  it("preserves partial results and source failures", async () => {
    const source = {
      load: vi
        .fn()
        .mockResolvedValue({ kind: "partial", rows: [], message: "History unavailable" }),
      cancel: vi.fn(),
    };
    expect(await loadReminderOperations(source, ["reminder.read"])).toMatchObject({
      kind: "partial",
    });
    source.load.mockRejectedValue(new ReminderOperationsProblem("Load failed"));
    await expect(loadReminderOperations(source, ["reminder.read"])).rejects.toThrow("Load failed");
  });
});
