import { DefaultEventSerializer, DomainEvent } from "@croco/events-core";
import { ProblemCategory } from "@croco/problems-core";
import { TxManager } from "@croco/tx-core";
import { describe, expect, it, vi } from "vitest";
import {
  InvalidTransactionalEventConfigurationProblem,
  InMemoryTransactionalEventStore,
  TransactionalInboxConsumer,
  TransactionalOutbox,
  TransactionalOutboxRelay,
} from "../index";
import type {
  TransactionalEventConfigurationConstraint,
  TransactionalEventConfigurationField,
  TransactionalOutboxMessage,
} from "../index";

class ConfigurationTestEvent extends DomainEvent {
  static eventName = "configuration.test";

  constructor(readonly value: string) {
    super();
  }
}

const POSITIVE_INTEGER_INVALID_VALUES = [
  -1,
  0,
  0.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  2_147_483_648,
  Number.MAX_SAFE_INTEGER,
];

const NON_NEGATIVE_INTEGER_INVALID_VALUES = [
  -1,
  0.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  2_147_483_648,
  Number.MAX_SAFE_INTEGER,
];

const POSITIVE_NUMBER_INVALID_VALUES = [
  -1,
  0,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

function expectedReceivedValue(value: number | string): number | string {
  if (typeof value === "string" || Number.isFinite(value)) {
    return value;
  }
  if (Number.isNaN(value)) {
    return "NaN";
  }
  return value === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
}

function assertInvalidConfiguration(
  error: unknown,
  field: TransactionalEventConfigurationField,
  constraint: TransactionalEventConfigurationConstraint,
  receivedValue: number | string,
): void {
  expect(error).toBeInstanceOf(InvalidTransactionalEventConfigurationProblem);
  if (!(error instanceof InvalidTransactionalEventConfigurationProblem)) {
    throw error;
  }
  expect(error.code).toBe("events-tx/configuration-invalid");
  expect(error.category).toBe(ProblemCategory.InternalServerError);
  expect(error.field).toBe(field);
  expect(error.constraint).toBe(constraint);
  expect(error.receivedValue).toBe(expectedReceivedValue(receivedValue));
  expect(error.toJSON()).toMatchObject({
    code: "events-tx/configuration-invalid",
    status: 500,
    field,
    constraint,
    receivedValue: expectedReceivedValue(receivedValue),
  });
}

function captureSyncFailure(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected configuration validation to fail synchronously.");
}

async function captureAsyncFailure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected configuration validation to fail.");
}

function createMessage(
  overrides: Partial<TransactionalOutboxMessage> = {},
): TransactionalOutboxMessage {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "message-1",
    eventId: "event-1",
    eventType: ConfigurationTestEvent.eventName,
    idempotencyKey: "event-1",
    payload: { value: "test" },
    metadata: {},
    attempts: 1,
    maxAttempts: 3,
    status: "pending",
    visibleAt: now,
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    diagnostics: [],
    ...overrides,
  };
}

describe("transactional event configuration validation", () => {
  it.each(POSITIVE_INTEGER_INVALID_VALUES)(
    "rejects invalid outbox constructor maxAttempts %s synchronously",
    (maxAttempts) => {
      const store = new InMemoryTransactionalEventStore();
      const error = captureSyncFailure(
        () =>
          new TransactionalOutbox({
            store,
            txManager: {
              isInTransaction: vi.fn(() => true),
              getClient: vi.fn(() => undefined),
            },
            maxAttempts,
          }),
      );

      assertInvalidConfiguration(error, "maxAttempts", "positive-int32", maxAttempts);
    },
  );

  it.each(POSITIVE_INTEGER_INVALID_VALUES)(
    "rejects append maxAttempts %s before every collaborator",
    async (maxAttempts) => {
      const store = new InMemoryTransactionalEventStore();
      const appendOutbox = vi.spyOn(store, "appendOutbox");
      const isInTransaction = vi.fn(() => true);
      const getClient = vi.fn(() => undefined);
      const serializer = new DefaultEventSerializer();
      const serialize = vi.spyOn(serializer, "serialize");
      const now = vi.fn(() => new Date("2026-01-01T00:00:00.000Z"));
      const idFactory = vi.fn(() => "message-1");
      const outbox = new TransactionalOutbox({
        store,
        txManager: { isInTransaction, getClient },
        serializer,
        now,
        idFactory,
      });

      const error = await captureAsyncFailure(() =>
        outbox.append(new ConfigurationTestEvent("test"), { maxAttempts }),
      );

      assertInvalidConfiguration(error, "maxAttempts", "positive-int32", maxAttempts);
      expect(isInTransaction).not.toHaveBeenCalled();
      expect(getClient).not.toHaveBeenCalled();
      expect(serialize).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      expect(idFactory).not.toHaveBeenCalled();
      expect(appendOutbox).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["batchSize", "batchSize"],
    ["visibilityTimeoutMs", "visibilityTimeoutMs"],
  ] as const)("rejects invalid relay constructor %s values", (option, field) => {
    for (const value of POSITIVE_INTEGER_INVALID_VALUES) {
      const store = new InMemoryTransactionalEventStore();
      const error = captureSyncFailure(
        () =>
          new TransactionalOutboxRelay({
            store,
            publish: vi.fn(async () => {}),
            [option]: value,
          }),
      );
      assertInvalidConfiguration(error, field, "positive-int32", value);
    }
  });

  it.each([
    ["baseDelayMs", "retry.baseDelayMs"],
    ["maxDelayMs", "retry.maxDelayMs"],
  ] as const)("rejects invalid retry %s values", (option, field) => {
    for (const value of NON_NEGATIVE_INTEGER_INVALID_VALUES) {
      const error = captureSyncFailure(
        () =>
          new TransactionalOutboxRelay({
            store: new InMemoryTransactionalEventStore(),
            publish: vi.fn(async () => {}),
            retry: { [option]: value },
          }),
      );
      assertInvalidConfiguration(error, field, "non-negative-int32", value);
    }
  });

  it.each(POSITIVE_NUMBER_INVALID_VALUES)("rejects invalid retry multiplier %s", (multiplier) => {
    const error = captureSyncFailure(
      () =>
        new TransactionalOutboxRelay({
          store: new InMemoryTransactionalEventStore(),
          publish: vi.fn(async () => {}),
          retry: { multiplier },
        }),
    );
    assertInvalidConfiguration(error, "retry.multiplier", "positive-finite-number", multiplier);
  });

  it.each([
    ["limit", "limit"],
    ["visibilityTimeoutMs", "visibilityTimeoutMs"],
  ] as const)(
    "rejects invalid relay override %s before every collaborator",
    async (option, field) => {
      for (const value of POSITIVE_INTEGER_INVALID_VALUES) {
        const store = new InMemoryTransactionalEventStore();
        const claimOutboxBatch = vi.spyOn(store, "claimOutboxBatch");
        const publish = vi.fn(async () => {});
        const getClient = vi.fn(() => undefined);
        const now = vi.fn(() => new Date("2026-01-01T00:00:00.000Z"));
        const relay = new TransactionalOutboxRelay({
          store,
          publish,
          txManager: { getClient },
          now,
        });

        const error = await captureAsyncFailure(() => relay.publishBatch({ [option]: value }));

        assertInvalidConfiguration(error, field, "positive-int32", value);
        expect(now).not.toHaveBeenCalled();
        expect(getClient).not.toHaveBeenCalled();
        expect(claimOutboxBatch).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["", " ", "\t\n"])("rejects blank consumerId %j synchronously", (consumerId) => {
    const store = new InMemoryTransactionalEventStore();
    const startInboxProcessing = vi.spyOn(store, "startInboxProcessing");
    const error = captureSyncFailure(() => new TransactionalInboxConsumer({ store, consumerId }));

    assertInvalidConfiguration(error, "consumerId", "non-blank-string-at-most-128", consumerId);
    expect(startInboxProcessing).not.toHaveBeenCalled();
  });

  it.each(POSITIVE_INTEGER_INVALID_VALUES)(
    "rejects invalid inbox visibilityTimeoutMs %s synchronously",
    (visibilityTimeoutMs) => {
      const store = new InMemoryTransactionalEventStore();
      const startInboxProcessing = vi.spyOn(store, "startInboxProcessing");
      const error = captureSyncFailure(
        () =>
          new TransactionalInboxConsumer({
            store,
            consumerId: "ledger-projection",
            visibilityTimeoutMs,
          }),
      );

      assertInvalidConfiguration(
        error,
        "visibilityTimeoutMs",
        "positive-int32",
        visibilityTimeoutMs,
      );
      expect(startInboxProcessing).not.toHaveBeenCalled();
    },
  );

  it("rejects consumerId values longer than 128 characters and accepts exactly 128", () => {
    const store = new InMemoryTransactionalEventStore();
    const tooLong = "a".repeat(129);
    const error = captureSyncFailure(
      () => new TransactionalInboxConsumer({ store, consumerId: tooLong }),
    );

    assertInvalidConfiguration(error, "consumerId", "non-blank-string-at-most-128", tooLong);
    expect(
      () => new TransactionalInboxConsumer({ store, consumerId: "a".repeat(128) }),
    ).not.toThrow();
    expect(
      () => new TransactionalInboxConsumer({ store, consumerId: "😀".repeat(128) }),
    ).not.toThrow();
    expect(() => new TransactionalInboxConsumer({ store, consumerId: "😀".repeat(129) })).toThrow(
      InvalidTransactionalEventConfigurationProblem,
    );
  });

  it("keeps zero-delay retries valid when a finite multiplier overflows exponentiation", async () => {
    const store = new InMemoryTransactionalEventStore();
    const txManager = new TxManager(store.createTxAdapter());
    const now = () => new Date("2026-01-01T00:00:00.000Z");
    const outbox = new TransactionalOutbox({ store, txManager, now });
    const message = await txManager.run(() =>
      outbox.append(new ConfigurationTestEvent("test"), { maxAttempts: 4 }),
    );
    const publish = vi.fn(async () => {
      throw new Error("offline");
    });
    const relay = new TransactionalOutboxRelay({
      store,
      publish,
      retry: { baseDelayMs: 0, maxDelayMs: 1_000, multiplier: Number.MAX_VALUE },
      now,
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await relay.publishBatch({ now: now() });
      expect(result.scheduledRetry).toBe(1);
      expect((await store.findOutboxById(message.id))?.visibleAt).toEqual(now());
    }
  });

  it("snapshots validated consumerId against later caller config mutation", async () => {
    const store = new InMemoryTransactionalEventStore();
    const config = { store, consumerId: "stable-consumer" };
    const consumer = new TransactionalInboxConsumer(config);
    const startInboxProcessing = vi.spyOn(store, "startInboxProcessing");

    config.consumerId = " ";
    await consumer.handle(createMessage(), async () => {});

    expect(startInboxProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ consumerId: "stable-consumer" }),
      undefined,
    );
  });

  it("accepts int32 boundaries, positive finite multipliers, and zero retry delays", async () => {
    const store = new InMemoryTransactionalEventStore();
    const txManager = new TxManager(store.createTxAdapter());
    const now = () => new Date("2026-01-01T00:00:00.000Z");
    expect(
      () =>
        new TransactionalOutboxRelay({
          store,
          publish: vi.fn(async () => {}),
          batchSize: 2_147_483_647,
          visibilityTimeoutMs: 2_147_483_647,
          retry: {
            baseDelayMs: 2_147_483_647,
            maxDelayMs: 2_147_483_647,
            multiplier: 0.5,
          },
        }),
    ).not.toThrow();
    expect(
      () =>
        new TransactionalInboxConsumer({
          store,
          consumerId: "ledger-projection",
          visibilityTimeoutMs: 2_147_483_647,
        }),
    ).not.toThrow();
    const outbox = new TransactionalOutbox({
      store,
      txManager,
      maxAttempts: 2_147_483_647,
      now,
    });
    const message = await txManager.run(() =>
      outbox.append(new ConfigurationTestEvent("test"), {
        maxAttempts: 2_147_483_647,
      }),
    );
    expect(message.maxAttempts).toBe(2_147_483_647);

    const relay = new TransactionalOutboxRelay({
      store,
      publish: vi.fn(async () => {
        throw new Error("offline");
      }),
      batchSize: 2_147_483_647,
      visibilityTimeoutMs: 2_147_483_647,
      retry: {
        baseDelayMs: 0,
        maxDelayMs: 2_147_483_647,
        multiplier: 0.5,
      },
      now,
    });
    const result = await relay.publishBatch({
      limit: 2_147_483_647,
      visibilityTimeoutMs: 2_147_483_647,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result.scheduledRetry).toBe(1);
    expect((await store.findOutboxById(message.id))?.visibleAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("preserves omitted defaults and a padded non-blank consumerId byte-for-byte", async () => {
    const store = new InMemoryTransactionalEventStore();
    const txManager = new TxManager(store.createTxAdapter());
    const outbox = new TransactionalOutbox({ store, txManager });
    const message = await txManager.run(() => outbox.append(new ConfigurationTestEvent("test")));
    expect(message.maxAttempts).toBe(3);

    const claimOutboxBatch = vi.spyOn(store, "claimOutboxBatch");
    const relay = new TransactionalOutboxRelay({ store, publish: vi.fn(async () => {}) });
    await relay.publishBatch();
    expect(claimOutboxBatch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, visibilityTimeoutMs: 30_000 }),
      undefined,
    );

    const paddedConsumerId = "  ledger-projection  ";
    const startInboxProcessing = vi.spyOn(store, "startInboxProcessing");
    const consumer = new TransactionalInboxConsumer({ store, consumerId: paddedConsumerId });
    await consumer.handle(
      createMessage({ id: "message-2", idempotencyKey: "event-2" }),
      async () => {},
    );
    expect(startInboxProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerId: paddedConsumerId,
        visibilityTimeoutMs: 30_000,
      }),
      undefined,
    );
  });
});
