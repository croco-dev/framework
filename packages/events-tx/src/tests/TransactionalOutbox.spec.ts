import {
  DefaultEventSerializer,
  DomainEvent,
  type EventBus,
  EventRegistry,
} from "@croco/events-core";
import { TxManager } from "@croco/tx-core";
import { describe, expect, it, vi } from "vitest";
import {
  createEventBusOutboxPublisher,
  DrizzleTransactionalEventStore,
  type DrizzleTransactionalEventStoreDb,
  InMemoryTransactionalEventStore,
  normalizeTransactionalEventError,
  OutboxStorageProblem,
  OutboxTransactionRequiredProblem,
  TransactionalInboxConsumer,
  TransactionalOutbox,
  TransactionalOutboxRelay,
  type TransactionalOutboxMessage,
} from "../index";

class AccountCreditedEvent extends DomainEvent {
  static eventName = "account.credited";

  constructor(
    readonly accountId: string,
    readonly amount: number,
  ) {
    super();
  }

  static fromPayload(payload: Record<string, unknown>): AccountCreditedEvent {
    return new AccountCreditedEvent(String(payload.accountId), Number(payload.amount));
  }
}

function createClock(initial: Date): { now: () => Date; advance: (ms: number) => Date } {
  let current = new Date(initial.getTime());
  return {
    now: () => new Date(current.getTime()),
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
      return new Date(current.getTime());
    },
  };
}

function createOutboxFixture() {
  const store = new InMemoryTransactionalEventStore();
  const txManager = new TxManager(store.createTxAdapter());
  const clock = createClock(new Date("2026-01-01T00:00:00.000Z"));
  let idCounter = 0;
  const outbox = new TransactionalOutbox({
    store,
    txManager,
    now: clock.now,
    idFactory: () => `message-${++idCounter}`,
  });

  return {
    store,
    txManager,
    clock,
    outbox,
  };
}

async function appendMessage(
  fixture: ReturnType<typeof createOutboxFixture>,
  options: { idempotencyKey?: string; maxAttempts?: number } = {},
): Promise<TransactionalOutboxMessage> {
  return fixture.txManager.run(() =>
    fixture.outbox.append(new AccountCreditedEvent("acct-1", 100), {
      aggregateId: "acct-1",
      idempotencyKey: options.idempotencyKey ?? "credit-acct-1",
      maxAttempts: options.maxAttempts,
    }),
  );
}

describe("TransactionalOutbox", () => {
  it("requires an active tx-core transaction and rolls back appended messages with the transaction", async () => {
    const fixture = createOutboxFixture();

    await expect(
      fixture.outbox.append(new AccountCreditedEvent("acct-1", 100)),
    ).rejects.toBeInstanceOf(OutboxTransactionRequiredProblem);

    await expect(
      fixture.txManager.run(async () => {
        await fixture.outbox.append(new AccountCreditedEvent("acct-1", 100), {
          aggregateId: "acct-1",
          idempotencyKey: "credit-acct-1",
        });
        throw new Error("business write failed");
      }),
    ).rejects.toThrow("business write failed");

    await expect(fixture.store.listOutboxMessages()).resolves.toHaveLength(0);
  });

  it("rejects append when tx-core reports a transaction without a client", async () => {
    const store = new InMemoryTransactionalEventStore();
    const outbox = new TransactionalOutbox({
      store,
      txManager: {
        isInTransaction: () => true,
        getClient: () => undefined,
      },
    });

    await expect(outbox.append(new AccountCreditedEvent("acct-1", 100))).rejects.toBeInstanceOf(
      OutboxTransactionRequiredProblem,
    );
  });

  it("appends only one outbox message for the same idempotency key in a transaction", async () => {
    const fixture = createOutboxFixture();

    const [first, second] = await fixture.txManager.run(async () => {
      const appended = await fixture.outbox.append(new AccountCreditedEvent("acct-1", 100), {
        aggregateId: "acct-1",
        idempotencyKey: "credit-acct-1",
      });
      const duplicate = await fixture.outbox.append(new AccountCreditedEvent("acct-1", 100), {
        aggregateId: "acct-1",
        idempotencyKey: "credit-acct-1",
      });
      return [appended, duplicate] as const;
    });

    expect(second.id).toBe(first.id);
    const messages = await fixture.store.listOutboxMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].aggregateId).toBe("acct-1");
    expect(messages[0].payload).toEqual({ accountId: "acct-1", amount: 100 });
  });
});

describe("TransactionalOutboxRelay", () => {
  it("keeps exhausted messages poisoned when no dead-letter hook is configured", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture, { maxAttempts: 1 });
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish: async () => {
        throw new Error("broker unavailable");
      },
      now: fixture.clock.now,
    });

    const result = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });

    expect(result).toMatchObject({
      claimed: 1,
      poisoned: 1,
      deadLettered: 0,
    });
    expect(result.results[0].status).toBe("poisoned");
    expect((await fixture.store.listOutboxMessages())[0]).toMatchObject({
      status: "poisoned",
      deadLetterReason: "broker unavailable",
    });
  });

  it("reschedules failed publishes, then moves exhausted messages through the dead-letter hook", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture, { maxAttempts: 2 });
    const publish = vi.fn(async () => {
      throw new Error("broker unavailable");
    });
    const deadLetter = vi.fn(async () => {});
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish,
      deadLetter,
      now: fixture.clock.now,
      retry: {
        baseDelayMs: 1_000,
      },
    });

    const first = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });
    expect(first.scheduledRetry).toBe(1);
    expect(first.deadLettered).toBe(0);
    expect((await fixture.store.listOutboxMessages())[0].status).toBe("retrying");

    const immediate = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });
    expect(immediate.claimed).toBe(0);

    fixture.clock.advance(1_000);
    const exhausted = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });
    expect(exhausted.deadLettered).toBe(1);
    expect(deadLetter).toHaveBeenCalledTimes(1);
    expect((await fixture.store.listOutboxMessages())[0].status).toBe("dead_lettered");
  });

  it("reclaims a publishing message after visibility timeout to support relay crash restart", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture);
    const claimed = await fixture.store.claimOutboxBatch({
      limit: 1,
      now: fixture.clock.now(),
      visibilityTimeoutMs: 1_000,
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].status).toBe("publishing");

    const published: string[] = [];
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish: async (message) => {
        published.push(message.id);
      },
      now: fixture.clock.now,
    });

    fixture.clock.advance(999);
    expect(await relay.publishBatch({ limit: 1, now: fixture.clock.now() })).toMatchObject({
      claimed: 0,
    });

    fixture.clock.advance(1);
    expect(await relay.publishBatch({ limit: 1, now: fixture.clock.now() })).toMatchObject({
      published: 1,
    });
    expect(published).toEqual([claimed[0].id]);
    expect((await fixture.store.listOutboxMessages())[0].status).toBe("published");
  });

  it("ignores stale completion from an expired claim after another relay wins", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture);
    const [firstClaim] = await fixture.store.claimOutboxBatch({
      limit: 1,
      now: fixture.clock.now(),
      visibilityTimeoutMs: 1_000,
    });

    fixture.clock.advance(1_000);
    const [secondClaim] = await fixture.store.claimOutboxBatch({
      limit: 1,
      now: fixture.clock.now(),
      visibilityTimeoutMs: 1_000,
    });
    await expect(
      fixture.store.markOutboxPublished({
        id: secondClaim.id,
        expectedAttempts: secondClaim.attempts,
        now: fixture.clock.now(),
      }),
    ).resolves.toMatchObject({
      status: "published",
      attempts: 2,
    });

    await expect(
      fixture.store.markOutboxPublished({
        id: firstClaim.id,
        expectedAttempts: firstClaim.attempts,
        now: fixture.clock.now(),
      }),
    ).resolves.toBeNull();
    await expect(
      fixture.store.markOutboxFailed({
        id: firstClaim.id,
        expectedAttempts: firstClaim.attempts,
        now: fixture.clock.now(),
        nextVisibleAt: fixture.clock.now(),
        error: {
          name: "Error",
          message: "stale relay failure",
        },
        diagnostic: {
          code: "events-tx/test-stale",
          message: "stale relay failure",
          at: fixture.clock.now(),
        },
      }),
    ).resolves.toBeNull();
    await expect(fixture.store.listOutboxMessages()).resolves.toMatchObject([
      {
        status: "published",
        attempts: 2,
      },
    ]);
  });

  it("reports stale claims when a publish hook completed the current claim first", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture);
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish: async (message) => {
        await fixture.store.markOutboxPublished({
          id: message.id,
          expectedAttempts: message.attempts,
          now: fixture.clock.now(),
        });
      },
      now: fixture.clock.now,
    });

    const result = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });

    expect(result).toMatchObject({
      claimed: 1,
      published: 0,
      staleClaimed: 1,
    });
    expect(result.results[0].status).toBe("stale_claim");
    expect((await fixture.store.listOutboxMessages())[0].status).toBe("published");
  });

  it("reports stale claims when a publish failure is already completed by another relay", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture);
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish: async (message) => {
        await fixture.store.markOutboxPublished({
          id: message.id,
          expectedAttempts: message.attempts,
          now: fixture.clock.now(),
        });
        throw new Error("late failure");
      },
      now: fixture.clock.now,
    });

    const result = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });

    expect(result).toMatchObject({
      claimed: 1,
      staleClaimed: 1,
    });
    expect(result.results[0]).toMatchObject({
      status: "stale_claim",
      diagnostic: {
        code: "events-tx/outbox-fail-stale-claim",
      },
    });
  });

  it("reports stale claims when a dead-letter hook completes the poisoned message first", async () => {
    const fixture = createOutboxFixture();
    await appendMessage(fixture, { maxAttempts: 1 });
    const relay = new TransactionalOutboxRelay({
      store: fixture.store,
      publish: async () => {
        throw new Error("broker unavailable");
      },
      deadLetter: async (message) => {
        await fixture.store.markOutboxDeadLettered({
          id: message.id,
          expectedAttempts: message.attempts,
          now: fixture.clock.now(),
          reason: "handled elsewhere",
          diagnostic: {
            code: "events-tx/test-dead-lettered",
            message: "handled elsewhere",
            at: fixture.clock.now(),
          },
        });
      },
      now: fixture.clock.now,
    });

    const result = await relay.publishBatch({ limit: 1, now: fixture.clock.now() });

    expect(result).toMatchObject({
      claimed: 1,
      staleClaimed: 1,
    });
    expect(result.results[0]).toMatchObject({
      status: "stale_claim",
      diagnostic: {
        code: "events-tx/outbox-dead-letter-stale-claim",
      },
    });
    expect((await fixture.store.listOutboxMessages())[0].status).toBe("dead_lettered");
  });
});

describe("TransactionalInboxConsumer", () => {
  it("deduplicates processed inbox keys and retries failed inbox records explicitly", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    const processedHandler = vi.fn(async () => {});
    const consumer = new TransactionalInboxConsumer({
      store: fixture.store,
      consumerId: "ledger-projection",
      now: fixture.clock.now,
    });

    const first = await consumer.handle(message, processedHandler);
    const duplicate = await consumer.handle(message, processedHandler);

    expect(first.status).toBe("processed");
    expect(duplicate.status).toBe("duplicate");
    expect(processedHandler).toHaveBeenCalledTimes(1);

    const failingMessage = await appendMessage(fixture, {
      idempotencyKey: "credit-acct-2",
    });
    const retryingConsumer = new TransactionalInboxConsumer({
      store: fixture.store,
      consumerId: "audit-projection",
      now: fixture.clock.now,
      throwOnError: false,
    });

    const failed = await retryingConsumer.handle(failingMessage, async () => {
      throw new Error("projection offline");
    });
    const retried = await retryingConsumer.handle(failingMessage, async () => {});

    expect(failed.status).toBe("failed");
    expect(retried.status).toBe("processed");
    expect(retried.record.attempts).toBe(2);
  });

  it("persists inbox failures and rethrows by default", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    const consumer = new TransactionalInboxConsumer({
      store: fixture.store,
      consumerId: "risk-projection",
      now: fixture.clock.now,
    });

    await expect(
      consumer.handle(message, async () => {
        throw new Error("projection offline");
      }),
    ).rejects.toThrow("projection offline");

    await expect(
      fixture.store.findInboxRecord("risk-projection", message.idempotencyKey),
    ).resolves.toMatchObject({
      status: "failed",
      failureReason: "projection offline",
    });
  });
});

describe("createEventBusOutboxPublisher", () => {
  it("publishes deserialized outbox messages to an EventBus", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    const published: DomainEvent[] = [];
    const eventBus: EventBus = {
      publish: async (event) => {
        published.push(event);
      },
      subscribe: () => {},
      unsubscribe: () => {},
      clear: () => {},
    };
    const serializer = new DefaultEventSerializer(
      new EventRegistry().register(AccountCreditedEvent),
    );

    await createEventBusOutboxPublisher(eventBus, serializer)(message);

    expect(published).toHaveLength(1);
    expect(published[0]).toBeInstanceOf(AccountCreditedEvent);
    expect((published[0] as AccountCreditedEvent).accountId).toBe("acct-1");
  });

  it("preserves trace context metadata when publishing to an EventBus", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    const published: DomainEvent[] = [];
    const eventBus: EventBus = {
      publish: async (event) => {
        published.push(event);
      },
      subscribe: () => {},
      unsubscribe: () => {},
      clear: () => {},
    };
    const serializer = new DefaultEventSerializer(
      new EventRegistry().register(AccountCreditedEvent),
    );

    await createEventBusOutboxPublisher(
      eventBus,
      serializer,
    )({
      ...message,
      metadata: {
        source: "outbox",
      },
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
        traceFlags: 1,
        isValid: true,
      },
    });

    expect(published[0].metadata).toMatchObject({
      source: "outbox",
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
      },
    });
  });
});

describe("TransactionalEventStore conformance", () => {
  it("provides deterministic append, claim, publish, and inbox state transitions", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    await expect(fixture.store.findOutboxByIdempotencyKey("credit-acct-1")).resolves.toMatchObject({
      id: message.id,
    });

    const claimed = await fixture.store.claimOutboxBatch({
      limit: 10,
      now: fixture.clock.now(),
      visibilityTimeoutMs: 5_000,
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ attempts: 1, status: "publishing" });

    await fixture.store.markOutboxPublished({
      id: claimed[0].id,
      expectedAttempts: claimed[0].attempts,
      now: fixture.clock.now(),
    });
    await expect(fixture.store.listOutboxMessages({ status: "published" })).resolves.toHaveLength(
      1,
    );

    const started = await fixture.store.startInboxProcessing({
      consumerId: "projection",
      messageId: message.id,
      inboxKey: message.idempotencyKey,
      eventType: message.eventType,
      now: fixture.clock.now(),
    });
    expect(started.status).toBe("started");
    await fixture.store.markInboxProcessed({
      consumerId: "projection",
      inboxKey: message.idempotencyKey,
      now: fixture.clock.now(),
    });
    const duplicate = await fixture.store.startInboxProcessing({
      consumerId: "projection",
      messageId: message.id,
      inboxKey: message.idempotencyKey,
      eventType: message.eventType,
      now: fixture.clock.now(),
    });
    expect(duplicate.status).toBe("duplicate");
  });

  it("keeps committed state isolated from mutated results and supports filtered inbox listing", async () => {
    const fixture = createOutboxFixture();
    const message = await appendMessage(fixture);
    const [listed] = await fixture.store.listOutboxMessages();

    listed.payload.amount = 999;
    listed.metadata.changed = true;

    await expect(fixture.store.findOutboxById(message.id)).resolves.toMatchObject({
      payload: {
        amount: 100,
      },
      metadata: {},
    });

    await fixture.store.startInboxProcessing({
      consumerId: "ledger-projection",
      messageId: message.id,
      inboxKey: message.idempotencyKey,
      eventType: message.eventType,
      now: fixture.clock.now(),
    });
    await fixture.store.markInboxFailed({
      consumerId: "ledger-projection",
      inboxKey: message.idempotencyKey,
      now: fixture.clock.now(),
      error: {
        name: "Error",
        message: "projection offline",
      },
      reason: "projection offline",
    });
    await fixture.store.startInboxProcessing({
      consumerId: "audit-projection",
      messageId: "message-2",
      inboxKey: "credit-acct-2",
      eventType: message.eventType,
      now: fixture.clock.now(),
    });

    await expect(
      fixture.store.listInboxRecords({
        consumerId: "ledger-projection",
        status: "failed",
        limit: 1,
      }),
    ).resolves.toMatchObject([
      {
        consumerId: "ledger-projection",
        status: "failed",
      },
    ]);
    await expect(fixture.store.listInboxRecords()).resolves.toHaveLength(2);
  });

  it("throws storage problems for missing outbox and inbox records", async () => {
    const fixture = createOutboxFixture();

    await expect(
      fixture.store.markOutboxPublished({
        id: "missing-message",
        expectedAttempts: 1,
        now: fixture.clock.now(),
      }),
    ).rejects.toBeInstanceOf(OutboxStorageProblem);
    await expect(
      fixture.store.markInboxProcessed({
        consumerId: "projection",
        inboxKey: "missing-key",
        now: fixture.clock.now(),
      }),
    ).rejects.toBeInstanceOf(OutboxStorageProblem);
    await expect(fixture.store.findOutboxById("missing-message")).resolves.toBeNull();
  });

  it("honors abort signals before and after in-memory transaction work", async () => {
    const store = new InMemoryTransactionalEventStore();
    const adapter = store.createTxAdapter();
    const abortedBefore = new AbortController();
    abortedBefore.abort(new Error("transaction cancelled"));

    await expect(
      adapter.transaction(async () => undefined, undefined, abortedBefore.signal),
    ).rejects.toThrow("transaction cancelled");

    const abortedAfter = new AbortController();
    await expect(
      adapter.transaction(
        async () => {
          abortedAfter.abort("cancelled");
        },
        undefined,
        abortedAfter.signal,
      ),
    ).rejects.toThrow("Transaction aborted");
  });
});

describe("DrizzleTransactionalEventStore", () => {
  it("uses the transaction client passed by tx-core context instead of the root db", async () => {
    const rootDb = createMockDrizzleDb({ failInsert: true });
    const txDb = createMockDrizzleDb();
    const store = new DrizzleTransactionalEventStore({
      db: rootDb,
    });
    const input = {
      id: "message-1",
      eventId: "event-1",
      eventType: "account.credited",
      aggregateId: "acct-1",
      idempotencyKey: "credit-acct-1",
      payload: { accountId: "acct-1", amount: 100 },
      metadata: {},
      maxAttempts: 3,
      visibleAt: new Date("2026-01-01T00:00:00.000Z"),
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    await expect(store.appendOutbox(input, { client: txDb })).resolves.toMatchObject({
      id: "message-1",
      eventType: "account.credited",
      status: "pending",
    });
    expect(rootDb.inserts).toHaveLength(0);
    expect(txDb.inserts).toHaveLength(1);
  });

  it("uses conflict-safe outbox append instead of catching unique violations", async () => {
    const existing = createOutboxRow({ id: "message-existing" });
    const db = createMockDrizzleDb({
      insertResults: [[]],
      selectResults: [[], [existing]],
    });
    const store = new DrizzleTransactionalEventStore({
      db,
    });

    await expect(
      store.appendOutbox({
        id: "message-1",
        eventId: "event-1",
        eventType: "account.credited",
        aggregateId: "acct-1",
        idempotencyKey: "credit-acct-1",
        payload: { accountId: "acct-1", amount: 100 },
        metadata: {},
        maxAttempts: 3,
        visibleAt: new Date("2026-01-01T00:00:00.000Z"),
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: "message-existing",
      idempotencyKey: "credit-acct-1",
    });
    expect(db.conflictTargets).toHaveLength(1);
  });

  it("returns duplicate when a concurrent inbox insert wins the unique key", async () => {
    const existing = createInboxRow({
      consumerId: "ledger-projection",
      inboxKey: "credit-acct-1",
      status: "processing",
    });
    const db = createMockDrizzleDb({
      insertResults: [[]],
      selectResults: [[], [existing]],
    });
    const store = new DrizzleTransactionalEventStore({
      db,
    });

    await expect(
      store.startInboxProcessing({
        consumerId: "ledger-projection",
        messageId: "message-1",
        inboxKey: "credit-acct-1",
        eventType: "account.credited",
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "duplicate",
      record: {
        consumerId: "ledger-projection",
        inboxKey: "credit-acct-1",
      },
    });
    expect(db.conflictTargets).toHaveLength(1);
  });

  it("returns null when a guarded outbox completion updates no rows", async () => {
    const db = createMockDrizzleDb({
      selectResults: [[createOutboxRow({ status: "publishing", attempts: 2 })]],
      updateResults: [[]],
    });
    const store = new DrizzleTransactionalEventStore({
      db,
    });

    await expect(
      store.markOutboxPublished({
        id: "message-1",
        expectedAttempts: 2,
        now: new Date("2026-01-01T00:00:01.000Z"),
      }),
    ).resolves.toBeNull();
    expect(db.updates).toMatchObject([
      {
        status: "published",
      },
    ]);
  });

  it("maps persisted Drizzle JSON fields, diagnostics, and optional timestamps", async () => {
    const db = createMockDrizzleDb({
      selectResults: [
        [
          createOutboxRow({
            aggregateId: null,
            payload: JSON.stringify({ accountId: "acct-1", amount: 100 }),
            metadata: JSON.stringify({ source: "db" }),
            traceContext: JSON.stringify({
              traceId: "trace-1",
              spanId: "span-1",
              traceFlags: 1,
              isValid: true,
            }),
            attempts: undefined,
            maxAttempts: undefined,
            lockedUntil: "2026-01-01T00:00:10.000Z",
            publishedAt: "2026-01-01T00:00:11.000Z",
            lastError: JSON.stringify({
              name: "BrokerError",
              message: "broker unavailable",
              stack: "stack",
              code: "BROKER_UNAVAILABLE",
            }),
            deadLetteredAt: "2026-01-01T00:00:12.000Z",
            deadLetterReason: "exhausted",
            diagnostics: JSON.stringify([
              {
                code: "events-tx/test",
                message: "diagnostic",
                at: "2026-01-01T00:00:00.000Z",
                details: {
                  attempt: 1,
                },
              },
              {
                at: "2026-01-01T00:00:01.000Z",
              },
            ]),
          }),
        ],
      ],
    });
    const store = new DrizzleTransactionalEventStore({
      db,
    });

    await expect(store.findOutboxById("message-1")).resolves.toMatchObject({
      id: "message-1",
      payload: {
        accountId: "acct-1",
      },
      metadata: {
        source: "db",
      },
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
        traceFlags: 1,
        isValid: true,
      },
      attempts: 0,
      maxAttempts: 1,
      lockedUntil: new Date("2026-01-01T00:00:10.000Z"),
      publishedAt: new Date("2026-01-01T00:00:11.000Z"),
      lastError: {
        name: "BrokerError",
        message: "broker unavailable",
        code: "BROKER_UNAVAILABLE",
      },
      deadLetteredAt: new Date("2026-01-01T00:00:12.000Z"),
      deadLetterReason: "exhausted",
      diagnostics: [
        {
          code: "events-tx/test",
          message: "diagnostic",
          details: {
            attempt: 1,
          },
        },
        {
          code: "events-tx/unknown-diagnostic",
          message: "Unknown diagnostic",
        },
      ],
    });
  });
});

describe("transactional event helpers", () => {
  it("normalizes non-Error publish failures and Error codes", () => {
    const coded = new Error("broker unavailable");
    Object.assign(coded, {
      code: "BROKER_UNAVAILABLE",
    });

    expect(normalizeTransactionalEventError(coded)).toMatchObject({
      name: "Error",
      message: "broker unavailable",
      code: "BROKER_UNAVAILABLE",
    });
    expect(normalizeTransactionalEventError("offline")).toEqual({
      name: "Error",
      message: "offline",
    });
  });
});

type MockDrizzleDb = DrizzleTransactionalEventStoreDb & {
  readonly inserts: Record<string, unknown>[];
  readonly updates: Record<string, unknown>[];
  readonly conflictTargets: unknown[];
};

function createOutboxRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "message-1",
    eventId: "event-1",
    eventType: "account.credited",
    aggregateId: "acct-1",
    idempotencyKey: "credit-acct-1",
    payload: { accountId: "acct-1", amount: 100 },
    metadata: {},
    traceContext: null,
    attempts: 0,
    maxAttempts: 3,
    status: "pending",
    visibleAt: new Date("2026-01-01T00:00:00.000Z"),
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lockedUntil: null,
    publishedAt: null,
    lastError: null,
    deadLetteredAt: null,
    deadLetterReason: null,
    diagnostics: [],
    ...overrides,
  };
}

function createInboxRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    consumerId: "ledger-projection",
    messageId: "message-1",
    inboxKey: "credit-acct-1",
    eventType: "account.credited",
    status: "processing",
    attempts: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    processedAt: null,
    failedAt: null,
    lastError: null,
    failureReason: null,
    metadata: {},
    diagnostics: [],
    ...overrides,
  };
}

function createMockDrizzleDb(
  options: {
    failInsert?: boolean;
    insertResults?: Record<string, unknown>[][];
    selectResults?: Record<string, unknown>[][];
    updateResults?: Record<string, unknown>[][];
  } = {},
): MockDrizzleDb {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const conflictTargets: unknown[] = [];
  const insertResults = [...(options.insertResults ?? [])];
  const selectResults = [...(options.selectResults ?? [])];
  const updateResults = [...(options.updateResults ?? [])];
  const db: MockDrizzleDb = {
    inserts,
    updates,
    conflictTargets,
    insert: () => ({
      values: (values) => ({
        onConflictDoNothing: (config) => ({
          returning: async () => {
            if (options.failInsert) {
              throw new Error("root db should not be used");
            }
            conflictTargets.push(config.target);
            inserts.push(values);
            return insertResults.shift() ?? [values];
          },
        }),
        returning: async () => {
          if (options.failInsert) {
            throw new Error("root db should not be used");
          }
          inserts.push(values);
          return insertResults.shift() ?? [values];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectResults.shift() ?? [],
          orderBy: () => ({
            limit: async () => selectResults.shift() ?? [],
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values) => ({
        where: () => ({
          returning: async () => {
            updates.push(values);
            return updateResults.shift() ?? [values];
          },
        }),
      }),
    }),
  };
  return db;
}
