import { describe, expect, it } from "vitest";
import { InMemoryTransactionalEventStore, OutboxStorageProblem } from "../index";
import type { AppendOutboxMessageInput, TransactionalOutboxMessage } from "../index";

const NOW = new Date("2026-01-02T03:04:05.000Z");

function createInput(): AppendOutboxMessageInput {
  return {
    id: "message-1",
    eventId: "event-1",
    eventType: "payment.received",
    idempotencyKey: "payment-1",
    payload: { nested: { amount: 125 }, items: [{ quantity: 3 }], at: new Date(NOW) },
    metadata: { source: { name: "checkout" } },
    diagnostics: [
      { code: "seed", message: "Seeded.", at: new Date(NOW), details: { nested: { attempt: 2 } } },
    ],
    maxAttempts: 3,
    visibleAt: new Date(NOW),
    occurredAt: new Date(NOW),
  };
}

function mutate(
  message: Pick<TransactionalOutboxMessage, "payload" | "metadata" | "diagnostics">,
): void {
  (message.payload.nested as { amount: number }).amount = 999;
  (message.payload.items as { quantity: number }[])[0].quantity = 7;
  (message.payload.at as Date).setUTCFullYear(2031);
  (message.metadata.source as { name: string }).name = "changed";
  (message.diagnostics[0].details?.nested as { attempt: number }).attempt = 9;
}

async function expectOriginal(store: InMemoryTransactionalEventStore): Promise<void> {
  const input = createInput();
  await expect(store.findOutboxById(input.id)).resolves.toMatchObject({
    payload: input.payload,
    metadata: input.metadata,
    diagnostics: expect.arrayContaining(input.diagnostics ?? []),
  });
}

describe("Transactional event snapshots", () => {
  it("owns append values before the caller can mutate them", async () => {
    const store = new InMemoryTransactionalEventStore();
    const input = createInput();
    const pending = store.appendOutbox(input);
    mutate({
      payload: input.payload,
      metadata: input.metadata ?? {},
      diagnostics: input.diagnostics ?? [],
    });
    await pending;
    await expectOriginal(store);
  });

  it.each(["append", "find", "key", "list", "claim"] as const)(
    "isolates the %s result",
    async (boundary) => {
      const store = new InMemoryTransactionalEventStore();
      const appended = await store.appendOutbox(createInput());
      const result =
        boundary === "append"
          ? appended
          : boundary === "find"
            ? await store.findOutboxById("message-1")
            : boundary === "key"
              ? await store.findOutboxByIdempotencyKey("payment-1")
              : boundary === "list"
                ? (await store.listOutboxMessages())[0]
                : (
                    await store.claimOutboxBatch({ limit: 1, now: NOW, visibilityTimeoutMs: 1000 })
                  )[0];
      expect(result).toBeTruthy();
      if (!result) return;
      mutate(result);
      await expectOriginal(store);
    },
  );

  it("rolls back direct transaction-local nested mutations and savepoint changes", async () => {
    const store = new InMemoryTransactionalEventStore();
    await store.appendOutbox(createInput());
    const adapter = store.createTxAdapter();
    const failure = new Error("rollback");
    await expect(
      adapter.transaction(async (client) => {
        const message = client.state.outbox.get("message-1");
        if (!message) throw new Error("Missing fixture");
        mutate(message);
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expectOriginal(store);

    await adapter.transaction(async (client) => {
      await expect(
        adapter.savepoint?.(client, async (nested) => {
          const message = nested.state.outbox.get("message-1");
          if (!message) throw new Error("Missing fixture");
          mutate(message);
          throw failure;
        }),
      ).rejects.toBe(failure);
      await expect(store.findOutboxById("message-1", { client })).resolves.toMatchObject({
        payload: createInput().payload,
      });
    });
    await expectOriginal(store);
  });

  it("merges nested transaction changes without leaking retained transaction state", async () => {
    const store = new InMemoryTransactionalEventStore();
    await store.appendOutbox(createInput());
    let retained: TransactionalOutboxMessage | undefined;
    await store.createTxAdapter().transaction(async (client) => {
      retained = client.state.outbox.get("message-1");
      if (!retained) throw new Error("Missing fixture");
      (retained.payload.nested as { amount: number }).amount = 450;
    });
    expect(retained).toBeDefined();
    if (retained) mutate(retained);
    await expect(store.findOutboxById("message-1")).resolves.toMatchObject({
      payload: { nested: { amount: 450 } },
    });
  });

  it("isolates inbox metadata and completion diagnostic details on every read", async () => {
    const store = new InMemoryTransactionalEventStore();
    const metadata = { nested: { value: 4 } };
    const pending = store.startInboxProcessing({
      consumerId: "consumer",
      messageId: "message",
      inboxKey: "key",
      eventType: "payment.received",
      now: NOW,
      metadata,
    });
    metadata.nested.value = 10;
    const started = await pending;
    (started.record.metadata.nested as { value: number }).value = 11;
    const diagnostic = {
      code: "complete",
      message: "Completed.",
      at: NOW,
      details: { nested: { value: 5 } },
    };
    const completion = store.markInboxProcessed({
      consumerId: "consumer",
      inboxKey: "key",
      expectedAttempts: 1,
      now: NOW,
      diagnostic,
    });
    diagnostic.details.nested.value = 12;
    const completed = await completion;
    (completed.diagnostics[1].details?.nested as { value: number }).value = 13;
    const listed = await store.listInboxRecords();
    expect(listed[0]).toMatchObject({
      metadata: { nested: { value: 4 } },
      diagnostics: [expect.anything(), { details: { nested: { value: 5 } } }],
    });
    (listed[0].metadata.nested as { value: number }).value = 14;
    await expect(store.findInboxRecord("consumer", "key")).resolves.toMatchObject({
      metadata: { nested: { value: 4 } },
    });
  });

  it("preserves dates, undefined, sparse arrays, own prototype keys and shared cyclic data", async () => {
    const store = new InMemoryTransactionalEventStore();
    const shared = { value: 6 };
    const sparse: unknown[] = [];
    sparse.length = 3;
    const payload: Record<string, unknown> = Object.assign(
      Object.create(null) as Record<string, unknown>,
      {
        first: shared,
        second: shared,
        omitted: undefined,
        sparse,
        at: new Date(NOW),
      },
    );
    Object.defineProperty(payload, "__proto__", { value: { safe: true }, enumerable: true });
    payload.self = payload;
    const result = await store.appendOutbox({ ...createInput(), payload });
    expect(Object.getPrototypeOf(result.payload)).toBeNull();
    expect(result.payload).toHaveProperty("omitted", undefined);
    expect(result.payload.sparse).toHaveLength(3);
    expect(0 in (result.payload.sparse as unknown[])).toBe(false);
    expect(result.payload.at).toEqual(NOW);
    expect(result.payload.at).not.toBe(payload.at);
    expect(result.payload.self).toBe(result.payload);
    expect(result.payload.first).toBe(result.payload.second);
    expect(result.payload.first).not.toBe(shared);
    expect(Object.hasOwn(result.payload, "__proto__")).toBe(true);
    (result.payload.first as { value: number }).value = 19;
    expect((await store.findOutboxById("message-1"))?.payload.first).toEqual({ value: 6 });
  });

  it("keeps an active claim unchanged when a diagnostic cannot be copied", async () => {
    const store = new InMemoryTransactionalEventStore();
    await store.appendOutbox(createInput());
    const [claimed] = await store.claimOutboxBatch({
      limit: 1,
      now: NOW,
      visibilityTimeoutMs: 1000,
    });
    await expect(
      store.markOutboxFailed({
        id: "message-1",
        expectedAttempts: 1,
        now: NOW,
        nextVisibleAt: NOW,
        error: { name: "Error", message: "Unavailable" },
        diagnostic: {
          code: "failed",
          message: "Failed.",
          at: NOW,
          details: { nested: { callback: () => undefined } },
        },
      }),
    ).rejects.toBeInstanceOf(OutboxStorageProblem);
    await expect(store.findOutboxById("message-1")).resolves.toEqual(claimed);
  });

  it.each([
    () => undefined,
    Symbol("unsupported"),
    new WeakMap(),
    new (class Opaque {
      value = 3;
    })(),
  ])("rejects unsupported values before inserting a message", async (value) => {
    const store = new InMemoryTransactionalEventStore();
    await expect(
      store.appendOutbox({ ...createInput(), payload: { nested: { value } } }),
    ).rejects.toBeInstanceOf(OutboxStorageProblem);
    await expect(store.listOutboxMessages()).resolves.toEqual([]);
    await expect(store.appendOutbox(createInput())).resolves.toMatchObject({ id: "message-1" });
  });
});
