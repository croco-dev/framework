import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryBillableUsageJournal,
  type BillableUsageClaim,
  type BillableUsageEvent,
} from "../libs/BillableUsageJournal";
import { MeteringTransitionProblem } from "../libs/problems/MeteringTransitionProblem";

const EVENT: BillableUsageEvent = {
  eventId: "event-1",
  tenantId: "tenant-1",
  meterId: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  value: 42,
  dimensions: { model: "gpt-5" },
};

describe("InMemoryBillableUsageJournal", () => {
  let journal!: InMemoryBillableUsageJournal;

  beforeEach(() => {
    journal = new InMemoryBillableUsageJournal();
  });

  it("returns duplicate success without creating another logical intent", async () => {
    expect((await journal.append(EVENT)).outcome).toBe("appended");
    expect((await journal.append({ ...EVENT, dimensions: { model: "gpt-5" } })).outcome).toBe(
      "duplicate",
    );
    expect((await journal.getDiagnostics()).backlogCount).toBe(1);
  });

  it("treats reordered envelope properties as the same deterministic event", async () => {
    await journal.append(EVENT);
    const reordered = {
      dimensions: { model: "gpt-5" },
      value: 42,
      unit: "token",
      aggregation: "SUM",
      meterId: "ai.tokens",
      tenantId: "tenant-1",
      eventId: "event-1",
    } as const;

    await expect(journal.append(reordered)).resolves.toMatchObject({ outcome: "duplicate" });
  });

  it("rejects the same eventId with a different deterministic envelope", async () => {
    await journal.append(EVENT);

    await expect(journal.append({ ...EVENT, value: 43 })).rejects.toThrow(
      MeteringTransitionProblem,
    );
    await expect(journal.append({ ...EVENT, value: 43 })).rejects.toMatchObject({
      code: "metering/transition-conflict",
    });
  });

  it("does not expose an appended intent to delivery before local commit activation", async () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    await journal.append(EVENT, now);

    expect(
      await journal.claimNext({ ownerId: "worker-1", leaseDurationMs: 1_000, now }),
    ).toBeNull();
    await journal.markDeliverable(EVENT.eventId, now);
    await expect(
      journal.claimNext({ ownerId: "worker-1", leaseDurationMs: 1_000, now }),
    ).resolves.toMatchObject({ state: "delivering", ownerId: "worker-1" });
  });

  it("permits one active owner and fences a stale owner after lease expiry", async () => {
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    await journal.append(EVENT, startedAt);
    await journal.markDeliverable(EVENT.eventId, startedAt);

    const first = await journal.claimNext({
      ownerId: "worker-1",
      leaseDurationMs: 1_000,
      now: startedAt,
    });
    expect(first).not.toBeNull();
    expect(
      await journal.claimNext({ ownerId: "worker-2", leaseDurationMs: 1_000, now: startedAt }),
    ).toBeNull();

    const second = await journal.claimNext({
      ownerId: "worker-2",
      leaseDurationMs: 1_000,
      now: new Date(startedAt.getTime() + 1_001),
    });
    expect(second?.fencingToken).toBeGreaterThan(first?.fencingToken ?? 0);
    await expect(
      journal.markAccepted(first as BillableUsageClaim, new Date(startedAt.getTime() + 500)),
    ).rejects.toMatchObject({ code: "metering/transition-conflict" });
  });

  it("keeps retryable and terminal failures distinguishable and inspectable", async () => {
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    await journal.append(EVENT, startedAt);
    await journal.markDeliverable(EVENT.eventId, startedAt);
    const first = await journal.claimNext({
      ownerId: "worker-1",
      leaseDurationMs: 1_000,
      now: startedAt,
    });

    const retryAt = new Date(startedAt.getTime() + 2_000);
    await journal.markRetryableFailed(
      first as BillableUsageClaim,
      { code: "provider/unavailable", message: "try later" },
      retryAt,
      new Date(startedAt.getTime() + 100),
    );
    expect((await journal.get(EVENT.eventId))?.state).toBe("retryable-failed");
    expect(
      await journal.claimNext({
        ownerId: "worker-2",
        leaseDurationMs: 1_000,
        now: new Date(startedAt.getTime() + 1_000),
      }),
    ).toBeNull();

    const retry = await journal.claimNext({
      ownerId: "worker-2",
      leaseDurationMs: 1_000,
      now: retryAt,
    });
    await journal.markTerminalFailed(
      retry as BillableUsageClaim,
      { code: "provider/rejected", message: "invalid meter" },
      new Date(retryAt.getTime() + 100),
    );
    expect(await journal.get(EVENT.eventId)).toMatchObject({
      state: "terminal-failed",
      retryCount: 1,
    });
    expect(await journal.getDiagnostics(new Date(retryAt.getTime() + 100))).toEqual({
      backlogCount: 0,
      oldestPendingAgeMs: null,
      retryCount: 1,
      terminalFailureCount: 1,
    });
  });

  it("removes accepted events from pending diagnostics only after acceptance is persisted", async () => {
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    await journal.append(EVENT, startedAt);
    await journal.markDeliverable(EVENT.eventId, startedAt);
    const claim = await journal.claimNext({
      ownerId: "worker-1",
      leaseDurationMs: 1_000,
      now: startedAt,
    });

    expect((await journal.getDiagnostics(startedAt)).backlogCount).toBe(1);
    await journal.markAccepted(claim as BillableUsageClaim, new Date(startedAt.getTime() + 100));
    expect(await journal.get(EVENT.eventId)).toMatchObject({ state: "accepted" });
    expect((await journal.getDiagnostics()).backlogCount).toBe(0);
  });
});
