import { describe, expect, it } from "vitest";
import {
  DrizzleTransactionalEventStore,
  InMemoryTransactionalEventStore,
  OutboxIdempotencyConflictProblem,
  OutboxStorageProblem,
  type AppendOutboxMessageInput,
  type DrizzleTransactionalEventStoreDb,
  type TransactionalEventStore,
} from "../index";

type OutboxStoreHarness = {
  store: TransactionalEventStore;
  appendWithContext: (input: AppendOutboxMessageInput) => Promise<unknown>;
  count: () => Promise<number>;
};

const NOW = new Date("2026-01-01T00:00:00.000Z");

function createInput(overrides: Partial<AppendOutboxMessageInput> = {}): AppendOutboxMessageInput {
  return {
    id: "message-1",
    eventId: "event-1",
    eventType: "order.created",
    aggregateId: "order-1",
    idempotencyKey: "orders:create:order-1",
    payload: { orderId: "order-1", amount: 100 },
    metadata: { producer: "orders" },
    maxAttempts: 3,
    visibleAt: new Date(NOW),
    occurredAt: new Date(NOW),
    ...overrides,
  };
}

function createInMemoryHarness(): OutboxStoreHarness {
  const store = new InMemoryTransactionalEventStore();
  const adapter = store.createTxAdapter();
  return {
    store,
    appendWithContext: (input) =>
      adapter.transaction((client) => store.appendOutbox(input, { client })),
    count: async () => (await store.listOutboxMessages()).length,
  };
}

function createStatefulDrizzleHarness(): OutboxStoreHarness {
  let row: Record<string, unknown> | undefined;
  const jsonRoundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
  const persist = (values: Record<string, unknown>): Record<string, unknown> => ({
    ...values,
    payload: jsonRoundTrip(values.payload),
    metadata: jsonRoundTrip(values.metadata),
  });
  const matchingRow = (condition: { queryChunks: readonly unknown[] } | undefined): unknown[] => {
    if (!row || !condition) {
      return row ? [row] : [];
    }
    const column = condition.queryChunks.find(
      (chunk) =>
        typeof chunk === "object" &&
        chunk !== null &&
        "name" in chunk &&
        typeof chunk.name === "string",
    );
    const parameter = condition.queryChunks.find(
      (chunk) =>
        typeof chunk === "object" &&
        chunk !== null &&
        "value" in chunk &&
        !Array.isArray(chunk.value),
    );
    if (
      typeof column !== "object" ||
      column === null ||
      !("name" in column) ||
      typeof column.name !== "string" ||
      typeof parameter !== "object" ||
      parameter === null ||
      !("value" in parameter)
    ) {
      return [];
    }
    const property = column.name === "idempotency_key" ? "idempotencyKey" : column.name;
    return row[property] === parameter.value ? [row] : [];
  };
  const db: DrizzleTransactionalEventStoreDb = {
    insert: () => ({
      values: (values) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (row) {
              return [];
            }
            row = persist(values);
            return [row];
          },
        }),
        returning: async () => {
          row = persist(values);
          return [row];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: (condition) => ({
          limit: async () => matchingRow(condition),
          orderBy: () => ({
            limit: async () => matchingRow(condition),
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values) => ({
        where: () => ({
          returning: async () => {
            row = row ? { ...row, ...values } : undefined;
            return row ? [row] : [];
          },
        }),
      }),
    }),
  };
  const store = new DrizzleTransactionalEventStore({ db });
  return {
    store,
    appendWithContext: (input) => store.appendOutbox(input, { client: db }),
    count: async () => (row ? 1 : 0),
  };
}

const implementations = [
  ["in-memory", createInMemoryHarness],
  ["Drizzle", createStatefulDrizzleHarness],
] as const;

describe.each(implementations)("%s outbox idempotency conformance", (_name, createHarness) => {
  it.each(["direct", "transaction context"] as const)(
    "rejects a reused row id before mutation through the %s append path",
    async (appendPath) => {
      const harness = createHarness();
      const first = createInput({
        id: "shared-row-id",
        idempotencyKey: "key-first",
        eventId: "event-first",
        payload: { event: "first" },
      });
      const conflicting = createInput({
        id: "shared-row-id",
        idempotencyKey: "key-second",
        eventId: "event-second",
        payload: { event: "second" },
      });

      await harness.store.appendOutbox(first);
      const append =
        appendPath === "direct"
          ? harness.store.appendOutbox(conflicting)
          : harness.appendWithContext(conflicting);

      await expect(append).rejects.toMatchObject({
        code: "events-tx/outbox-message-id-conflict",
        category: "Conflict",
        extensions: { id: "shared-row-id" },
      });
      await expect(harness.store.findOutboxById("shared-row-id")).resolves.toMatchObject(first);
      await expect(harness.store.findOutboxByIdempotencyKey("key-first")).resolves.toMatchObject(
        first,
      );
      await expect(harness.store.findOutboxByIdempotencyKey("key-second")).resolves.toBeNull();
      await expect(harness.count()).resolves.toBe(1);
    },
  );

  it("replays the existing row for an identical canonical request", async () => {
    const harness = createHarness();
    const input = createInput();
    const inserted = await harness.store.appendOutbox(input);

    await expect(harness.store.appendOutbox(createInput())).resolves.toEqual(inserted);
    await expect(harness.count()).resolves.toBe(1);
  });

  it.each([
    ["event id", { eventId: "event-2" }, ["eventId"]],
    ["event type", { eventType: "payment.captured" }, ["eventType"]],
    ["aggregate", { aggregateId: "order-2" }, ["aggregateId"]],
    ["payload", { payload: { orderId: "order-1", amount: 101 } }, ["payload"]],
    ["metadata", { metadata: { producer: "billing" } }, ["metadata"]],
  ] as const)("rejects a different %s for the same key", async (_label, overrides, fields) => {
    const harness = createHarness();
    await harness.store.appendOutbox(createInput());

    await expect(harness.store.appendOutbox(createInput(overrides))).rejects.toMatchObject({
      code: "events-tx/outbox-idempotency-conflict",
      category: "Conflict",
      extensions: {
        idempotencyKey: "orders:create:order-1",
        conflictingFields: fields,
      },
    });
    await expect(harness.count()).resolves.toBe(1);
  });

  it("allows a generated storage row id to differ on replay", async () => {
    const harness = createHarness();
    const inserted = await harness.store.appendOutbox(createInput());

    await expect(harness.store.appendOutbox(createInput({ id: "message-retry" }))).resolves.toEqual(
      inserted,
    );
    await expect(harness.count()).resolves.toBe(1);
  });

  it("ignores attempt-specific delivery defaults on replay", async () => {
    const harness = createHarness();
    const inserted = await harness.store.appendOutbox(createInput());

    await expect(
      harness.store.appendOutbox(
        createInput({
          id: "message-retry",
          maxAttempts: 9,
          visibleAt: new Date("2026-01-01T00:01:00.000Z"),
        }),
      ),
    ).resolves.toEqual(inserted);
    await expect(harness.count()).resolves.toBe(1);
  });

  it("compares payload and metadata using JSON storage semantics", async () => {
    const harness = createHarness();
    const input = createInput({
      payload: {
        occurredOn: new Date("2026-01-01T00:00:00.000Z"),
        omitted: undefined,
      },
      metadata: {
        observedOn: new Date("2026-01-01T00:00:00.000Z"),
        omitted: undefined,
      },
    });
    const inserted = await harness.store.appendOutbox(input);

    await expect(
      harness.store.appendOutbox(createInput({ ...input, id: "message-retry" })),
    ).resolves.toMatchObject({
      id: inserted.id,
    });
    await expect(harness.count()).resolves.toBe(1);
  });

  it("resolves concurrent conflicting appends as one insert and one typed conflict", async () => {
    const harness = createHarness();
    const results = await Promise.allSettled([
      harness.store.appendOutbox(createInput()),
      harness.store.appendOutbox(
        createInput({
          id: "message-2",
          eventId: "event-2",
          eventType: "payment.captured",
          payload: { paymentId: "payment-1" },
          metadata: { producer: "billing" },
        }),
      ),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toMatchObject([
      {
        reason: {
          code: "events-tx/outbox-idempotency-conflict",
        },
      },
    ]);
    await expect(harness.count()).resolves.toBe(1);
  });

  it("resolves concurrent row id reuse as one insert and one typed conflict", async () => {
    const harness = createHarness();
    const results = await Promise.allSettled([
      harness.store.appendOutbox(createInput({ id: "shared-row-id", idempotencyKey: "key-first" })),
      harness.store.appendOutbox(
        createInput({
          id: "shared-row-id",
          idempotencyKey: "key-second",
          eventId: "event-second",
          payload: { event: "second" },
        }),
      ),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toMatchObject([
      {
        reason: {
          code: "events-tx/outbox-message-id-conflict",
          extensions: { id: "shared-row-id" },
        },
      },
    ]);
    await expect(harness.count()).resolves.toBe(1);
  });
});

describe("InMemoryTransactionalEventStore transactional idempotency", () => {
  it("atomically reserves a key when transactions start together", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const results = await Promise.allSettled([
      adapter.transaction((client) => store.appendOutbox(createInput(), { client })),
      adapter.transaction((client) =>
        store.appendOutbox(
          createInput({
            id: "message-2",
            eventId: "event-2",
            payload: { orderId: "order-2" },
          }),
          { client },
        ),
      ),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toMatchObject([
      {
        reason: {
          code: "events-tx/outbox-idempotency-conflict",
        },
      },
    ]);
    await expect(store.listOutboxMessages()).resolves.toHaveLength(1);
  });

  it("replays an identical transaction after a direct append starts first", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const direct = store.appendOutbox(createInput());
    const transactional = adapter.transaction(async (client) => {
      const result = await store.appendOutbox(createInput({ id: "message-2" }), { client });
      return result.id;
    });

    await expect(direct).resolves.toMatchObject({ id: "message-1" });
    await expect(transactional).resolves.toBe("message-1");
    await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
  });

  it("types a conflict when a direct append starts before a different transaction", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const direct = store.appendOutbox(createInput());
    const transactional = adapter.transaction((client) =>
      store.appendOutbox(
        createInput({
          id: "message-2",
          eventId: "event-2",
          payload: { orderId: "order-2" },
        }),
        { client },
      ),
    );

    await expect(direct).resolves.toMatchObject({ id: "message-1" });
    await expect(transactional).rejects.toBeInstanceOf(OutboxIdempotencyConflictProblem);
    await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
  });

  it("serializes identical transactions before primitive ids can diverge", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    let releaseFirst = (): void => {};
    let markFirstReady = (): void => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstReady = new Promise<void>((resolve) => {
      markFirstReady = resolve;
    });

    const first = adapter.transaction(async (client) => {
      const result = await store.appendOutbox(createInput(), { client });
      markFirstReady();
      await firstGate;
      return result.id;
    });
    await firstReady;
    const second = adapter.transaction(async (client) => {
      const result = await store.appendOutbox(createInput({ id: "message-2" }), { client });
      return result.id;
    });

    releaseFirst();
    await expect(first).resolves.toBe("message-1");
    await expect(second).resolves.toBe("message-1");
    await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
  });

  it("preserves primitive ids returned through savepoints", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    let releaseFirst = (): void => {};
    let markFirstReady = (): void => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstReady = new Promise<void>((resolve) => {
      markFirstReady = resolve;
    });

    const first = adapter.transaction((client) =>
      adapter.savepoint(client, async (nestedClient) => {
        const result = await store.appendOutbox(createInput(), { client: nestedClient });
        markFirstReady();
        await firstGate;
        return result.id;
      }),
    );
    await firstReady;
    const second = adapter.transaction(async (client) => {
      const result = await store.appendOutbox(createInput({ id: "message-2" }), { client });
      return result.id;
    });

    releaseFirst();
    await expect(first).resolves.toBe("message-1");
    await expect(second).resolves.toBe("message-1");
    await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
  });

  it("reports the same typed conflict when conflicting transactions race", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    let releaseFirst = (): void => {};
    let markFirstReady = (): void => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstReady = new Promise<void>((resolve) => {
      markFirstReady = resolve;
    });

    const first = adapter.transaction(async (client) => {
      const result = await store.appendOutbox(createInput(), { client });
      markFirstReady();
      await firstGate;
      return result.id;
    });
    await firstReady;
    const second = adapter.transaction((client) =>
      store.appendOutbox(
        createInput({
          id: "message-2",
          eventId: "event-2",
          payload: { orderId: "order-2" },
        }),
        { client },
      ),
    );
    releaseFirst();

    await expect(first).resolves.toBe("message-1");
    await expect(second).rejects.toBeInstanceOf(OutboxIdempotencyConflictProblem);
    await expect(second).rejects.toMatchObject({
      extensions: {
        conflictingFields: ["eventId", "payload"],
      },
    });
    await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
  });

  it("reports the row id conflict when different-key transactions race", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    let releaseTransactions = (): void => {};
    let markReady = (): void => {};
    const transactionGate = new Promise<void>((resolve) => {
      releaseTransactions = resolve;
    });
    const bothReady = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let readyCount = 0;
    const append = (input: AppendOutboxMessageInput): Promise<string> =>
      adapter.transaction(async (client) => {
        const result = await store.appendOutbox(input, { client });
        readyCount += 1;
        if (readyCount === 2) {
          markReady();
        }
        await transactionGate;
        return result.id;
      });
    const first = append(createInput({ id: "shared-row-id", idempotencyKey: "key-first" }));
    const second = append(
      createInput({
        id: "shared-row-id",
        idempotencyKey: "key-second",
        eventId: "event-second",
        payload: { event: "second" },
      }),
    );

    await bothReady;
    releaseTransactions();
    const results = await Promise.allSettled([first, second]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toMatchObject([
      {
        reason: {
          code: "events-tx/outbox-message-id-conflict",
          extensions: { id: "shared-row-id" },
        },
      },
    ]);
    await expect(store.listOutboxMessages()).resolves.toHaveLength(1);
  });

  it.each([
    ["identical", createInput({ id: "message-nested" })],
    [
      "conflicting",
      createInput({
        id: "message-nested",
        eventId: "event-nested",
        payload: { orderId: "order-nested" },
      }),
    ],
  ] as const)(
    "fails a %s same-key nested transaction without deadlocking",
    async (_label, nestedInput) => {
      const store = new InMemoryTransactionalEventStore();
      const adapter = store.createTxAdapter();

      await adapter.transaction(async (outerClient) => {
        await store.appendOutbox(createInput(), { client: outerClient });
        await expect(
          adapter.transaction((nestedClient) =>
            store.appendOutbox(nestedInput, { client: nestedClient }),
          ),
        ).rejects.toBeInstanceOf(OutboxStorageProblem);
      });

      await expect(store.listOutboxMessages()).resolves.toMatchObject([{ id: "message-1" }]);
    },
  );
});
