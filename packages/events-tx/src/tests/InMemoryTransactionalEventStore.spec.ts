import { describe, expect, it } from "vitest";
import { InMemoryTransactionalEventStore } from "../index";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const CLAIM = { limit: 10, now: NOW, visibilityTimeoutMs: 1_000 };

async function append(
  store: InMemoryTransactionalEventStore,
  id: string,
  createdAt: Date,
  visibleAt: Date = NOW,
  maxAttempts = 3,
): Promise<void> {
  await store.appendOutbox({
    id,
    eventId: id,
    eventType: "account.changed",
    aggregateId: "account-1",
    idempotencyKey: id,
    payload: {},
    maxAttempts,
    visibleAt,
    occurredAt: createdAt,
    diagnostics: [{ code: "seed", message: "Seeded.", at: createdAt }],
  });
}

describe("InMemoryTransactionalEventStore outbox aggregate claims", () => {
  it("waits for an earlier created message even when its visibility is later", async () => {
    const store = new InMemoryTransactionalEventStore();
    const later = new Date(NOW.getTime() + 1_000);
    await append(store, "later-created", later);
    await append(store, "earlier-created", NOW, later);

    expect(await store.claimOutboxBatch(CLAIM)).toEqual([]);
    expect((await store.claimOutboxBatch({ ...CLAIM, now: later })).map(({ id }) => id)).toEqual([
      "earlier-created",
    ]);
    expect(await store.claimOutboxBatch({ ...CLAIM, now: later })).toEqual([]);
    await store.markOutboxPublished({ id: "earlier-created", expectedAttempts: 1, now: later });
    expect((await store.claimOutboxBatch({ ...CLAIM, now: later })).map(({ id }) => id)).toEqual([
      "later-created",
    ]);
  });

  it("uses message id to order equal timestamps rather than insertion order", async () => {
    const store = new InMemoryTransactionalEventStore();
    await append(store, "b", NOW);
    await append(store, "a", NOW);

    expect((await store.claimOutboxBatch(CLAIM)).map(({ id }) => id)).toEqual(["a"]);
    await store.markOutboxPublished({ id: "a", expectedAttempts: 1, now: NOW });
    expect((await store.claimOutboxBatch(CLAIM)).map(({ id }) => id)).toEqual(["b"]);
  });

  it("keeps a successor behind an active or expired lease until its predecessor is poisoned", async () => {
    const store = new InMemoryTransactionalEventStore();
    await append(store, "a", NOW, NOW, 2);
    await append(store, "b", NOW);

    expect((await store.claimOutboxBatch(CLAIM)).map(({ id }) => id)).toEqual(["a"]);
    expect(await store.claimOutboxBatch(CLAIM)).toEqual([]);

    const afterLease = new Date(NOW.getTime() + 1_000);
    expect(
      (await store.claimOutboxBatch({ ...CLAIM, now: afterLease })).map(({ id }) => id),
    ).toEqual(["a"]);
    expect(await store.claimOutboxBatch({ ...CLAIM, now: afterLease })).toEqual([]);

    await store.markOutboxFailed({
      id: "a",
      expectedAttempts: 2,
      now: afterLease,
      nextVisibleAt: afterLease,
      error: { name: "Error", message: "Broker unavailable." },
      diagnostic: { code: "failed", message: "Publish failed.", at: afterLease },
    });
    expect(
      (await store.claimOutboxBatch({ ...CLAIM, now: afterLease })).map(({ id }) => id),
    ).toEqual(["b"]);
  });
});
