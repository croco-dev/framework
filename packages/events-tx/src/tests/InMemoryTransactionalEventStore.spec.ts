import { getEventListeners } from "node:events";
import { describe, expect, it } from "vitest";
import {
  TransactionRollbackConfirmedProblem,
  TransactionTimeoutProblem,
  TxManager,
} from "@croco/tx-core";
import type { InMemoryTransactionalEventStoreClient } from "../index";
import {
  InMemoryTransactionalEventStore,
  OutboxMessageIdConflictProblem,
  OutboxStorageProblem,
} from "../index";

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

function deferred() {
  let resolve = (): void => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function within<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Reservation operation did not settle")), 500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function reserve(
  store: InMemoryTransactionalEventStore,
  key: string,
  client?: InMemoryTransactionalEventStoreClient,
  id = key,
) {
  return store.appendOutbox(
    {
      id,
      eventId: key,
      eventType: "account.changed",
      idempotencyKey: key,
      payload: {},
      maxAttempts: 3,
      visibleAt: NOW,
      occurredAt: NOW,
    },
    client ? { client } : undefined,
  );
}

async function holdReservation(store: InMemoryTransactionalEventStore, key: string) {
  const ready = deferred();
  const release = deferred();
  const transaction = store.createTxAdapter().transaction(async (client) => {
    await reserve(store, key, client);
    ready.resolve();
    await release.promise;
  });
  await within(ready.promise);
  return { release: release.resolve, transaction };
}

describe("InMemoryTransactionalEventStore reservation cancellation", () => {
  it("rolls back an aborted waiter and releases its earlier reservations while the holder remains active", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const waiting = deferred();
    const controller = new AbortController();
    const reason = new Error("Cancelled waiter");
    const transaction = store.createTxAdapter().transaction(
      async (client) => {
        await reserve(store, "earlier", client);
        const pending = reserve(store, "held", client);
        waiting.resolve();
        await pending;
      },
      undefined,
      controller.signal,
    );
    const outcome = transaction.catch((error: unknown) => error);
    try {
      await within(waiting.promise);
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
      controller.abort(reason);
      const error = await within(outcome);
      expect(error).toBeInstanceOf(TransactionRollbackConfirmedProblem);
      expect(error).toMatchObject({ cause: reason });
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
      await expect(store.listOutboxMessages()).resolves.toEqual([]);
      await within(reserve(store, "earlier"));
      await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "earlier" }]);
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
    await within(reserve(store, "held"));
    await expect(store.listOutboxMessages()).resolves.toHaveLength(2);
  });

  it("breaks a reverse two-key wait when one transaction is cancelled", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const firstReady = deferred();
    const secondReady = deferred();
    const firstWaiting = deferred();
    const secondWaiting = deferred();
    const cleanup = deferred();
    const controller = new AbortController();
    const first = adapter.transaction(
      async (client) => {
        await reserve(store, "a", client);
        firstReady.resolve();
        await secondReady.promise;
        const pending = reserve(store, "b", client);
        firstWaiting.resolve();
        await pending;
      },
      undefined,
      controller.signal,
    );
    const firstOutcome = first.catch((error: unknown) => error);
    const second = adapter.transaction(async (client) => {
      await reserve(store, "b", client);
      secondReady.resolve();
      await firstReady.promise;
      const pending = reserve(store, "a", client);
      secondWaiting.resolve();
      await Promise.race([pending, cleanup.promise]);
    });
    try {
      await within(Promise.all([firstWaiting.promise, secondWaiting.promise]));
      controller.abort(new Error("Break cycle"));
      expect(await within(firstOutcome)).toBeInstanceOf(TransactionRollbackConfirmedProblem);
      await within(second);
      expect((await store.listOutboxMessages()).map(({ id }) => id).sort()).toEqual(["a", "b"]);
      await within(reserve(store, "a"));
      await within(reserve(store, "b"));
    } finally {
      cleanup.resolve();
      await Promise.allSettled([first, second]);
    }
  });

  it("reports a TxManager timeout as confirmed rollback and permits reservation reuse", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const manager = new TxManager(store.createTxAdapter());
    const transaction = manager.run(
      async () => {
        const client = manager.getClient();
        if (!client) throw new Error("Expected active transaction client");
        await reserve(store, "earlier", client);
        await reserve(store, "held", client);
      },
      { timeout: 30 },
    );
    const outcome = transaction.catch((error: unknown) => error);
    try {
      expect(await within(outcome)).toBeInstanceOf(TransactionTimeoutProblem);
      await expect(store.listOutboxMessages()).resolves.toEqual([]);
      await within(reserve(store, "earlier"));
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
    expect((await store.listOutboxMessages()).map(({ id }) => id).sort()).toEqual([
      "earlier",
      "held",
    ]);
  });

  it("preserves a typed TxManager timeout when the callback catches reservation cancellation", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const manager = new TxManager(store.createTxAdapter());
    const transaction = manager.run(
      async () => {
        const client = manager.getClient();
        if (!client) throw new Error("Expected active transaction client");
        await reserve(store, "earlier", client);
        await expect(reserve(store, "held", client)).rejects.toBeInstanceOf(
          TransactionRollbackConfirmedProblem,
        );
        return "caught cancellation";
      },
      { timeout: 30 },
    );
    const outcome = transaction.catch((error: unknown) => error);
    try {
      expect(await within(outcome)).toBeInstanceOf(TransactionTimeoutProblem);
      await expect(store.listOutboxMessages()).resolves.toEqual([]);
      await within(reserve(store, "earlier"));
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
  });

  it.each(["own", "parent", "parent-only"] as const)(
    "cancels a savepoint waiting on its %s signal",
    async (source) => {
      const store = new InMemoryTransactionalEventStore();
      const adapter = store.createTxAdapter();
      const holder = await holdReservation(store, "held");
      const parent = new AbortController();
      const own = new AbortController();
      const waiting = deferred();
      const reason = new Error("Cancel savepoint");
      const transaction = adapter.transaction(
        async (client) => {
          await reserve(store, "outer", client);
          await adapter.savepoint(
            client,
            async (nested) => {
              await reserve(store, "nested", nested);
              const pending = reserve(store, "held", nested);
              waiting.resolve();
              await pending;
            },
            undefined,
            source === "parent-only" ? undefined : own.signal,
          );
        },
        undefined,
        parent.signal,
      );
      const outcome = transaction.catch((error: unknown) => error);
      try {
        await within(waiting.promise);
        (source === "own" ? own : parent).abort(reason);
        const error = await within(outcome);
        expect(error).toBeInstanceOf(TransactionRollbackConfirmedProblem);
        expect(error).toMatchObject({ cause: reason });
        await expect(store.listOutboxMessages()).resolves.toEqual([]);
        await within(reserve(store, "outer"));
        await within(reserve(store, "nested"));
      } finally {
        holder.release();
        await Promise.allSettled([holder.transaction, transaction]);
      }
      await expect(store.listOutboxMessages()).resolves.toHaveLength(3);
    },
  );

  it("rejects an uncontended append after callback cancellation before staging a row", async () => {
    const store = new InMemoryTransactionalEventStore();
    const controller = new AbortController();
    const reason = new Error("Cancelled before append");
    const transaction = store.createTxAdapter().transaction(
      async (client) => {
        controller.abort(reason);
        await expect(reserve(store, "cancelled", client)).rejects.toBeInstanceOf(
          TransactionRollbackConfirmedProblem,
        );
        await expect(store.listOutboxMessages({}, { client })).resolves.toEqual([]);
      },
      undefined,
      controller.signal,
    );
    const error = await within(transaction.catch((failure: unknown) => failure));
    expect(error).toBeInstanceOf(TransactionRollbackConfirmedProblem);
    expect(error).toMatchObject({ cause: reason });
    await expect(store.listOutboxMessages()).resolves.toEqual([]);
    await within(reserve(store, "cancelled"));
    await expect(store.listOutboxMessages()).resolves.toHaveLength(1);
  });

  it("lets the parent recover from savepoint cancellation without merging nested rows", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const holder = await holdReservation(store, "held");
    const parent = new AbortController();
    const own = new AbortController();
    const waiting = deferred();
    const transaction = adapter.transaction(
      async (client) => {
        await reserve(store, "outer", client);
        const nested = adapter.savepoint(
          client,
          async (nestedClient) => {
            await reserve(store, "discarded", nestedClient);
            const pending = reserve(store, "held", nestedClient);
            waiting.resolve();
            await pending;
          },
          undefined,
          own.signal,
        );
        await expect(nested).rejects.toBeInstanceOf(TransactionRollbackConfirmedProblem);
        expect(parent.signal.aborted).toBe(false);
        await expect(store.findOutboxById("discarded", { client })).resolves.toBeNull();
        await reserve(store, "discarded", client);
        await reserve(store, "surviving", client);
      },
      undefined,
      parent.signal,
    );
    try {
      await within(waiting.promise);
      own.abort(new Error("Cancel only savepoint"));
      await within(transaction);
      expect((await store.listOutboxMessages()).map(({ id }) => id).sort()).toEqual([
        "discarded",
        "outer",
        "surviving",
      ]);
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
    await within(reserve(store, "discarded"));
    await expect(store.listOutboxMessages()).resolves.toHaveLength(4);
  });

  it.each([false, true])(
    "preserves a holder commit after savepoint replay rolls back (root retry: %s)",
    async (retry) => {
      const store = new InMemoryTransactionalEventStore();
      const adapter = store.createTxAdapter();
      const holder = await holdReservation(store, "held");
      const own = new AbortController();
      const waiting = deferred();
      const reason = new Error("Cancel after replay");
      const transaction = adapter.transaction(async (client) => {
        await reserve(store, "outer", client);
        const nested = adapter.savepoint(
          client,
          async (nestedClient) => {
            const pending = reserve(store, "held", nestedClient);
            waiting.resolve();
            await expect(pending).resolves.toMatchObject({ id: "held" });
            own.abort(reason);
          },
          undefined,
          own.signal,
        );
        await expect(nested).rejects.toMatchObject({ cause: reason });
        if (retry) {
          await expect(reserve(store, "held", client, "root-retry")).resolves.toMatchObject({
            id: "held",
          });
        }
      });
      try {
        await within(waiting.promise);
        holder.release();
        await within(transaction);
        expect((await store.listOutboxMessages()).map(({ id }) => id).sort()).toEqual([
          "held",
          "outer",
        ]);
      } finally {
        holder.release();
        await Promise.allSettled([holder.transaction, transaction]);
      }
    },
  );

  it.each([false, true])(
    "preserves adoption through cancelled ancestor savepoints (inner cancelled: %s)",
    async (cancelInner) => {
      const store = new InMemoryTransactionalEventStore();
      const adapter = store.createTxAdapter();
      const holder = await holdReservation(store, "held");
      const middleAbort = new AbortController();
      const innerAbort = new AbortController();
      const waiting = deferred();
      const transaction = adapter.transaction(async (root) => {
        await reserve(store, "outer", root);
        const middle = adapter.savepoint(
          root,
          async (middleClient) => {
            await reserve(store, "middle", middleClient);
            const inner = adapter.savepoint(
              middleClient,
              async (innerClient) => {
                await reserve(store, "inner", innerClient);
                const pending = reserve(store, "held", innerClient);
                waiting.resolve();
                await pending;
                if (cancelInner) innerAbort.abort(new Error("Cancel inner"));
              },
              undefined,
              innerAbort.signal,
            );
            if (cancelInner) {
              await expect(inner).rejects.toBeInstanceOf(TransactionRollbackConfirmedProblem);
            } else {
              await inner;
            }
            middleAbort.abort(new Error("Cancel middle"));
          },
          undefined,
          middleAbort.signal,
        );
        await expect(middle).rejects.toBeInstanceOf(TransactionRollbackConfirmedProblem);
      });
      try {
        await within(waiting.promise);
        holder.release();
        await within(transaction);
        expect((await store.listOutboxMessages()).map(({ id }) => id).sort()).toEqual([
          "held",
          "outer",
        ]);
      } finally {
        holder.release();
        await Promise.allSettled([holder.transaction, transaction]);
      }
    },
  );

  it("preserves an ancestor's staged publication when a savepoint replays an existing row", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    await reserve(store, "held");
    await within(
      adapter.transaction(async (client) => {
        await expect(store.claimOutboxBatch(CLAIM, { client })).resolves.toMatchObject([
          { id: "held", attempts: 1 },
        ]);
        await store.markOutboxPublished({ id: "held", expectedAttempts: 1, now: NOW }, { client });
        await adapter.savepoint(client, async (nestedClient) => {
          await expect(reserve(store, "held", nestedClient)).resolves.toMatchObject({
            id: "held",
            status: "published",
          });
        });
        await expect(store.findOutboxById("held", { client })).resolves.toMatchObject({
          status: "published",
        });
      }),
    );
    await expect(store.findOutboxById("held")).resolves.toMatchObject({
      status: "published",
      attempts: 1,
    });
  });

  it("rejects an ancestor row-id collision without partially adopting the holder's row", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const holder = await holdReservation(store, "held");
    const waiting = deferred();
    const transaction = adapter.transaction(async (client) => {
      await reserve(store, "local", client, "held");
      const nested = adapter.savepoint(client, async (nestedClient) => {
        const pending = reserve(store, "held", nestedClient);
        waiting.resolve();
        await expect(pending).rejects.toBeInstanceOf(OutboxMessageIdConflictProblem);
        await expect(
          store.findOutboxByIdempotencyKey("held", { client: nestedClient }),
        ).resolves.toBeNull();
        await expect(store.findOutboxById("held", { client: nestedClient })).resolves.toMatchObject(
          { idempotencyKey: "local" },
        );
      });
      await nested;
      await expect(store.findOutboxByIdempotencyKey("held", { client })).resolves.toBeNull();
      await expect(store.findOutboxById("held", { client })).resolves.toMatchObject({
        idempotencyKey: "local",
      });
    });
    const outcome = transaction.catch((error: unknown) => error);
    try {
      await within(waiting.promise);
      holder.release();
      expect(await within(outcome)).toBeInstanceOf(OutboxMessageIdConflictProblem);
      await expect(store.listOutboxMessages()).resolves.toMatchObject([
        { id: "held", idempotencyKey: "held" },
      ]);
      await expect(store.findOutboxByIdempotencyKey("local")).resolves.toBeNull();
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
  });

  it("rejects competing updates during replay without clobbering staged state or its baseline", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    await reserve(store, "held");
    const transaction = adapter.transaction(async (client) => {
      await store.claimOutboxBatch(CLAIM, { client });
      await store.markOutboxPublished({ id: "held", expectedAttempts: 1, now: NOW }, { client });
      await expect(store.claimOutboxBatch(CLAIM)).resolves.toMatchObject([
        { id: "held", status: "publishing" },
      ]);
      await adapter.savepoint(client, async (nestedClient) => {
        await expect(reserve(store, "held", nestedClient)).rejects.toBeInstanceOf(
          OutboxStorageProblem,
        );
        await expect(store.findOutboxById("held", { client: nestedClient })).resolves.toMatchObject(
          { status: "published" },
        );
      });
      await expect(store.findOutboxById("held", { client })).resolves.toMatchObject({
        status: "published",
      });
    });
    await expect(within(transaction)).rejects.toBeInstanceOf(OutboxStorageProblem);
    await expect(store.listOutboxMessages()).resolves.toMatchObject([
      { id: "held", status: "publishing", attempts: 1 },
    ]);
  });

  it("does not stage a waiting append when cancellation races the holder release", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const controller = new AbortController();
    const waiting = deferred();
    const reason = new Error("Cancel during release");
    const transaction = store.createTxAdapter().transaction(
      async (client) => {
        const pending = reserve(store, "held", client);
        waiting.resolve();
        await expect(pending).rejects.toMatchObject({ cause: reason });
        await expect(store.findOutboxById("held", { client })).resolves.toBeNull();
      },
      undefined,
      controller.signal,
    );
    const outcome = transaction.catch((error: unknown) => error);
    try {
      await within(waiting.promise);
      holder.release();
      controller.abort(reason);
      const error = await within(outcome);
      expect(error).toBeInstanceOf(TransactionRollbackConfirmedProblem);
      expect(error).toMatchObject({ cause: reason });
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
  });

  it("honors an AbortSignal timeout while a reservation holder remains active", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const signal = AbortSignal.timeout(30);
    const transaction = store
      .createTxAdapter()
      .transaction((client) => reserve(store, "held", client), undefined, signal);
    const outcome = transaction.catch((error: unknown) => error);
    try {
      const error = await within(outcome);
      expect(error).toBeInstanceOf(TransactionRollbackConfirmedProblem);
      expect(error).toMatchObject({ cause: signal.reason });
      expect(signal.reason).toMatchObject({ name: "TimeoutError" });
      expect(getEventListeners(signal, "abort")).toHaveLength(0);
      await expect(store.listOutboxMessages()).resolves.toEqual([]);
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
    await within(reserve(store, "held"));
    await expect(store.listOutboxMessages()).resolves.toHaveLength(1);
  });

  it("removes the abort listener when the reservation is released normally", async () => {
    const store = new InMemoryTransactionalEventStore();
    const holder = await holdReservation(store, "held");
    const controller = new AbortController();
    const waiting = deferred();
    const transaction = store.createTxAdapter().transaction(
      async (client) => {
        const pending = reserve(store, "held", client);
        waiting.resolve();
        await pending;
      },
      undefined,
      controller.signal,
    );
    try {
      await within(waiting.promise);
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
      holder.release();
      await within(transaction);
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
      await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "held" }]);
    } finally {
      holder.release();
      await Promise.allSettled([holder.transaction, transaction]);
    }
  });
});
