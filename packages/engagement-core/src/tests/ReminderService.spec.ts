import { describe, expect, it, vi } from "vitest";
import { InMemoryReminderStore } from "../libs/InMemoryReminderStore";
import { ReminderService } from "../libs/ReminderService";
import {
  ReminderAccessDeniedProblem,
  ReminderConflictProblem,
  ReminderDispatchProblem,
  ReminderInvalidProblem,
} from "../libs/ReminderContracts";
import type { ReminderInput } from "../libs/ReminderContracts";
import type { ReminderServiceOptions } from "../libs/ReminderService";

const scope = { app: "app", environment: "test", tenantId: "tenant" };
const access = { scope, subject: "person", actor: { id: "person", reason: "user request" } };
const input: ReminderInput = {
  topic: "task",
  resourceRef: "task-1",
  timezone: "UTC",
  schedule: { localTime: "10:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  channel: "push",
  lateDeliveryMs: 60_000,
};
const create = { ...access, id: "r1", idempotencyKey: "create", input };
const revision = { ...access, id: "r1", expectedVersion: 1, idempotencyKey: "change" };
function setup(overrides: Partial<ReminderServiceOptions> = {}) {
  let instant = new Date("2026-10-05T09:00:00Z");
  const store = new InMemoryReminderStore();
  const send = vi.fn(async () => ({
    status: "queued" as const,
    executionIds: ["e1"],
    channelResults: [],
  }));
  const options: ReminderServiceOptions = {
    store,
    clock: () => instant,
    authorize: async () => true,
    validateInput: async () => {},
    resourceState: async () => "active",
    send,
    ...overrides,
  };
  const service = new ReminderService(options);
  return {
    store,
    send,
    options,
    service,
    at: (value: string) => {
      instant = new Date(value);
    },
  };
}

describe("ReminderService", () => {
  it("audits mutations, replays matching keys, rejects drift and stale revisions", async () => {
    const { service, store } = setup();
    const original = await service.create(create);
    expect(await service.create(create)).toEqual(original);
    await expect(
      service.create({ ...create, input: { ...input, topic: "other" } }),
    ).rejects.toBeInstanceOf(ReminderConflictProblem);
    await service.update({ ...revision, input: { ...input, timezone: "Asia/Seoul" } });
    await expect(service.cancel({ ...revision, idempotencyKey: "stale" })).rejects.toBeInstanceOf(
      ReminderConflictProblem,
    );
    const audits = await store.transact(
      scope,
      "person",
      async (transaction) => transaction.mutations,
    );
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ actor: "person", reason: "user request" });
  });

  it("requires tenant scope, server permission and subject ownership", async () => {
    const { service } = setup();
    await expect(
      service.create({ ...create, scope: { ...scope, tenantId: "" } }),
    ).rejects.toBeInstanceOf(ReminderInvalidProblem);
    await expect(
      service.create({ ...create, actor: { id: "operator", reason: "manual" } }),
    ).rejects.toBeInstanceOf(ReminderAccessDeniedProblem);
    const denied = setup({ authorize: async () => false });
    await expect(denied.service.create(create)).rejects.toBeInstanceOf(ReminderAccessDeniedProblem);
    await service.create(create);
    expect(await service.list({ ...access, scope: { ...scope, tenantId: "other" } })).toEqual([]);
    await service.cancel({ ...revision, actor: { id: "operator", reason: "support" } });
    await expect(
      service.update({ ...revision, expectedVersion: 2, idempotencyKey: "enable", input }),
    ).rejects.toBeInstanceOf(ReminderConflictProblem);
  });

  it("checks server input ownership and registration for create and update", async () => {
    const validateInput = vi.fn(async () => {});
    const { service } = setup({ validateInput });
    await service.create(create);
    validateInput.mockRejectedValueOnce(new ReminderAccessDeniedProblem());
    await expect(service.update({ ...revision, input })).rejects.toBeInstanceOf(
      ReminderAccessDeniedProblem,
    );
    expect((await service.list(access))[0]?.version).toBe(1);
  });

  it("expires backlog once and advances without a catch-up burst", async () => {
    const { service, at, send } = setup();
    await service.create(create);
    at("2026-10-09T15:00:00Z");
    expect(await service.runDue(access)).toMatchObject([
      { state: "expired", reason: "skip-missed" },
    ]);
    expect(send).not.toHaveBeenCalled();
    expect((await service.list(access))[0]?.nextScheduledAt).toEqual(
      new Date("2026-10-10T10:00:00Z"),
    );
    expect(await service.runDue(access)).toHaveLength(1);
  });

  it.each([
    ["2026-10-09T10:00:00Z", "queued", 1],
    ["2026-10-09T10:00:30Z", "queued", 1],
    ["2026-10-09T10:01:01Z", "expired", 0],
  ] as const)(
    "recovers only the latest occurrence after backlog at %s",
    async (time, state, count) => {
      const { service, at, send } = setup();
      await service.create(create);
      at(time);
      expect(await service.runDue(access)).toMatchObject([
        {
          scheduledAt: new Date("2026-10-09T10:00:00Z"),
          state,
        },
      ]);
      expect(send).toHaveBeenCalledTimes(count);
      expect((await service.list(access))[0]?.nextScheduledAt).toEqual(
        new Date("2026-10-10T10:00:00Z"),
      );
      await service.runDue(access);
      expect(send).toHaveBeenCalledTimes(count);
    },
  );

  it("expires an older pending occurrence even when its late window overlaps the latest", async () => {
    const { service, at, send } = setup();
    await service.create({ ...create, input: { ...input, lateDeliveryMs: 7 * 86_400_000 } });
    at("2026-10-05T10:00:00Z");
    await service.dueOccurrences(access);
    at("2026-10-09T10:00:00Z");
    expect(await service.runDue(access)).toMatchObject([
      { scheduledAt: new Date("2026-10-05T10:00:00Z"), state: "expired", reason: "skip-missed" },
      { scheduledAt: new Date("2026-10-09T10:00:00Z"), state: "queued" },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["2026-10-09T10:00:00Z", "queued", 1],
    ["2026-10-09T10:00:30Z", "queued", 1],
    ["2026-10-09T10:01:01Z", "expired", 0],
  ] as const)(
    "retains missed snooze evidence and resumes the latest recurrence at %s",
    async (time, state, count) => {
      const { service, at, send } = setup();
      await service.create(create);
      await service.snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
      at(time);
      expect(await service.runDue(access)).toMatchObject([
        { scheduledAt: new Date("2026-10-05T12:00:00Z"), state: "expired", reason: "skip-missed" },
        { scheduledAt: new Date("2026-10-09T10:00:00Z"), state },
      ]);
      expect(send).toHaveBeenCalledTimes(count);
      expect((await service.list(access))[0]?.nextScheduledAt).toEqual(
        new Date("2026-10-10T10:00:00Z"),
      );
      await service.runDue(access);
      expect(send).toHaveBeenCalledTimes(count);
    },
  );

  it("does not substitute a recurrence before an expired snooze timestamp", async () => {
    const { service, at, send } = setup();
    await service.create(create);
    await service.snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
    at("2026-10-05T13:00:00Z");
    expect(await service.runDue(access)).toMatchObject([
      { scheduledAt: new Date("2026-10-05T12:00:00Z"), state: "expired", reason: "skip-missed" },
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it("delivers only the snooze when it remains within grace across later recurrences", async () => {
    const { service, at, send } = setup();
    await service.create({ ...create, input: { ...input, lateDeliveryMs: 7 * 86_400_000 } });
    await service.snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
    at("2026-10-09T10:00:00Z");
    expect(await service.runDue(access)).toMatchObject([
      { scheduledAt: new Date("2026-10-05T12:00:00Z"), state: "queued" },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("snoozes one occurrence and restores the recurring schedule", async () => {
    const { service, at } = setup();
    await service.create(create);
    await service.snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
    at("2026-10-05T10:00:00Z");
    expect(await service.runDue(access)).toEqual([]);
    at("2026-10-05T12:00:00Z");
    expect(await service.runDue(access)).toMatchObject([{ state: "queued" }]);
    expect((await service.list(access))[0]).toMatchObject({
      state: "active",
      schedule: input.schedule,
      nextScheduledAt: new Date("2026-10-06T10:00:00Z"),
    });
  });

  it("invalidates materialized occurrences on timezone change and cancellation", async () => {
    const { service, at, send } = setup();
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    await service.dueOccurrences(access);
    await service.update({ ...revision, input: { ...input, timezone: "Asia/Seoul" } });
    expect(await service.runDue(access)).toMatchObject([
      { state: "suppressed", reason: "superseded" },
    ]);
    expect(send).not.toHaveBeenCalled();
    await service.cancel({ ...revision, expectedVersion: 2, idempotencyKey: "cancel" });
    at("2026-10-06T01:00:00Z");
    expect(await service.runDue(access)).toHaveLength(1);
  });

  it("cancellation completed before admission prevents sends", async () => {
    const { service, at, send } = setup();
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    await service.dueOccurrences(access);
    await service.cancel(revision);
    await service.runDue(access);
    expect(send).not.toHaveBeenCalled();
    expect(await service.history(access)).toMatchObject([
      { state: "suppressed", reason: "canceled" },
    ]);
  });

  it("persists admission before send and cancellation cannot recall admitted work", async () => {
    let finish: (value: {
      status: "queued";
      executionIds: string[];
      channelResults: [];
    }) => void = () => {};
    let notify: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const sent = new Promise<{ status: "queued"; executionIds: string[]; channelResults: [] }>(
      (resolve) => {
        finish = resolve;
      },
    );
    const send = vi.fn(async () => {
      notify();
      return sent;
    });
    const { service, at } = setup({ send });
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    const running = service.runDue(access);
    await started;
    expect(await service.history(access)).toMatchObject([{ state: "unknown" }]);
    await service.cancel(revision);
    await service.runDue(access);
    expect(send).toHaveBeenCalledTimes(1);
    finish({ status: "queued", executionIds: ["accepted"], channelResults: [] });
    expect(await running).toMatchObject([{ state: "queued", executionIds: ["accepted"] }]);
  });

  it("does not resend unknown work after restart and audits explicit reconciliation", async () => {
    const cause = new ReminderInvalidProblem("network failed after acceptance");
    const send = vi.fn(async () => {
      throw cause;
    });
    const { service, options, at, store } = setup({ send });
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    await expect(service.runDue(access)).rejects.toMatchObject({ cause });
    const [occurrence] = await service.history(access);
    expect(occurrence).toMatchObject({ state: "unknown", reason: "send-failed" });
    const restarted = new ReminderService(options);
    await restarted.runDue(access);
    expect(send).toHaveBeenCalledTimes(1);
    const reconcile = {
      ...access,
      idempotencyKey: "reconcile",
      occurrenceId: occurrence!.id,
      evidence: "provider lookup confirms not accepted",
      outcome: "not-accepted" as const,
      executionIds: [],
    };
    await restarted.reconcile(reconcile);
    await restarted.reconcile(reconcile);
    expect(await restarted.history(access)).toMatchObject([{ state: "suppressed" }]);
    const mutations = await store.transact(
      scope,
      "person",
      async (transaction) => transaction.mutations,
    );
    expect(mutations[1]).toMatchObject({
      evidence: reconcile.evidence,
      outcome: "not-accepted",
      actor: "person",
      reason: "user request",
    });
  });

  it.each(["completed", "deleted"] as const)(
    "rechecks %s resources before admission",
    async (state) => {
      const { service, at, send } = setup({ resourceState: async () => state });
      await service.create(create);
      at("2026-10-05T10:00:00Z");
      expect(await service.runDue(access)).toMatchObject([
        { state: "suppressed", reason: `resource-${state}` },
      ]);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("serializes concurrent runners and safely recovers unadmitted claims", async () => {
    const { service, at, send, store, options } = setup();
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    await service.dueOccurrences(access);
    await store.transact(scope, "person", async (transaction) => {
      const occurrence = transaction.occurrences[0];
      if (!occurrence) throw new ReminderInvalidProblem("missing test occurrence");
      transaction.saveOccurrence({ ...occurrence, state: "claimed" });
    });
    const restarted = new ReminderService(options);
    await Promise.all([service.runDue(access), restarted.runDue(access)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await service.history(access)).toMatchObject([{ state: "queued" }]);
  });

  it("uses one reference time throughout a runner call", async () => {
    let instant = new Date("2026-10-05T09:00:00Z");
    const clock = vi.fn(() => instant);
    const { service, send } = setup({
      clock,
      resourceState: async () => {
        instant = new Date("2026-10-05T15:00:00Z");
        return "active";
      },
    });
    await service.create(create);
    instant = new Date("2026-10-05T10:00:00Z");
    clock.mockClear();
    await service.runDue(access);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("preserves policy suppression and verified accepted reconciliation", async () => {
    const send = vi
      .fn<ReminderServiceOptions["send"]>()
      .mockResolvedValueOnce({ status: "suppressed", reason: "preference", channelResults: [] })
      .mockRejectedValueOnce(new ReminderInvalidProblem("unknown acceptance"));
    const { service, at } = setup({ send });
    await service.create(create);
    at("2026-10-05T10:00:00Z");
    expect(await service.runDue(access)).toMatchObject([
      { state: "suppressed", reason: "preference" },
    ]);
    at("2026-10-06T10:00:00Z");
    await expect(service.runDue(access)).rejects.toBeInstanceOf(ReminderDispatchProblem);
    const occurrences = await service.history(access);
    const unknown = occurrences.find((item) => item.state === "unknown");
    if (!unknown) throw new ReminderInvalidProblem("missing test occurrence");
    await service.reconcile({
      ...access,
      idempotencyKey: "accepted",
      occurrenceId: unknown.id,
      evidence: "durable execution lookup",
      outcome: "accepted",
      executionIds: ["e-confirmed"],
    });
    expect(await service.history(access)).toMatchObject([
      { state: "suppressed" },
      { state: "queued", executionIds: ["e-confirmed"] },
    ]);
    await service.runDue(access);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("isolates snapshots and rolls back a failed transaction", async () => {
    const { service, store } = setup();
    const reminder = await service.create(create);
    reminder.nextScheduledAt?.setUTCFullYear(2000);
    expect((await service.list(access))[0]?.nextScheduledAt?.getUTCFullYear()).toBe(2026);
    await expect(
      store.transact(scope, "person", async (transaction) => {
        transaction.saveReminder({ ...reminder, state: "canceled" });
        throw new ReminderInvalidProblem("rollback");
      }),
    ).rejects.toBeInstanceOf(ReminderInvalidProblem);
    expect((await service.list(access))[0]?.state).toBe("active");
  });
});

describe("Reminder ownership boundary", () => {
  it("retains immutable identity when a structurally assignable input carries surplus fields", async () => {
    const { service } = setup();
    await service.create(create);
    const supplied = {
      ...input,
      id: "other",
      subject: "victim",
      scope: { ...scope, tenantId: "other" },
      version: 999,
      state: "canceled",
      nextScheduledAt: null,
    };
    expect(await service.update({ ...revision, input: supplied })).toMatchObject({
      id: "r1",
      scope,
      subject: "person",
      version: 2,
      state: "active",
    });
    expect(await service.list({ ...access, scope: { ...scope, tenantId: "other" } })).toEqual([]);
  });
});
