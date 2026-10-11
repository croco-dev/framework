import { randomUUID } from "node:crypto";

import { DomainEvent } from "@croco/events-core";
import {
  DrizzleTransactionalEventStore,
  TransactionalInboxConsumer,
  TransactionalOutbox,
  TransactionalOutboxRelay,
  type DrizzleTransactionalEventStoreDb,
} from "@croco/events-tx";
import { AnalyticsOutboxConsumer } from "@croco/etl-events-tx";
import {
  installPostgresQuarantineSchema,
  PostgresQuarantineStore,
} from "@croco/etl-events-tx/postgres";
import { TxManager, type TxAdapter } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseWriter,
} from "@croco/warehouse-postgres/facts";
import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { FactDescriptor } from "@croco/warehouse-core";
import type { WarehouseAccess, WarehouseWriter } from "@croco/warehouse-core/runtime";
import { EtlEventProblem } from "../index";

const live = process.env.CROCO_TEST_REAL_RESOURCES === "1";
const instant = new Date("2026-09-28T12:00:00.000Z");

const paymentFact = defineFact("outbox_payment_event", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One provider capture or refund", key: ["provider", "operationId"] },
  columns: {
    provider: c.id(),
    operationId: c.id(),
    operationKind: c.string(),
    captureId: c.id(),
    sourceEventId: c.id(),
    amount: c.moneyMinor({ currency: "currency", min: BigInt(0) }),
    currency: c.currencyCode(),
    occurredAt: c.instant({ precision: "millisecond" }),
  },
  time: { event: "occurredAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

class PaymentRecorded extends DomainEvent {
  static eventName = "payment.recorded";

  constructor(
    readonly provider: string,
    readonly operationId: string,
    readonly operationKind: "capture" | "refund",
    readonly captureId: string,
    readonly amount: string,
  ) {
    super();
    this.metadata = {
      analytics: {
        sourceRef: "payments",
        schemaVersion: 1,
        subject: captureId,
        origin: "server-payment-service",
      },
    };
  }
}

describe.skipIf(!live)("outbox payment facts on PostgreSQL", () => {
  let connection: PostgresTestConnection;
  let dispose: () => Promise<void> | void;
  let descriptor: FactDescriptor;
  let table: string;
  let sequence = 0;

  beforeAll(async () => {
    const resource = postgresResource({ id: "outbox-fact-source", mode: "commit" });
    const started = await resource.start({
      register: () => undefined,
      testId: "outbox-fact-source",
      workerId: "etl-events-tx",
    });
    connection = started.connection;
    dispose = started.dispose;
    descriptor = await compileFact(paymentFact);
    table = `wh_fact_${descriptor.semanticHash.slice(0, 48)}`;
    await connection.pool.query(`
      CREATE TABLE example_payments (
        id text PRIMARY KEY,
        kind text NOT NULL,
        amount bigint NOT NULL
      );
      CREATE TABLE croco_outbox_messages (
        id varchar(128) PRIMARY KEY,
        event_id varchar(128) NOT NULL,
        event_type text NOT NULL,
        aggregate_id text,
        idempotency_key varchar(255) NOT NULL UNIQUE,
        payload jsonb NOT NULL,
        metadata jsonb NOT NULL,
        trace_context jsonb,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 3,
        status text NOT NULL,
        visible_at timestamp NOT NULL,
        occurred_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        locked_until timestamp,
        published_at timestamp,
        last_error jsonb,
        dead_lettered_at timestamp,
        dead_letter_reason text,
        diagnostics jsonb NOT NULL
      );
      CREATE TABLE croco_inbox_records (
        consumer_id varchar(128) NOT NULL,
        message_id varchar(128) NOT NULL,
        inbox_key varchar(255) NOT NULL,
        event_type text NOT NULL,
        status text NOT NULL,
        attempts integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        locked_until timestamp,
        processed_at timestamp,
        failed_at timestamp,
        last_error jsonb,
        failure_reason text,
        metadata jsonb NOT NULL,
        diagnostics jsonb NOT NULL,
        UNIQUE (consumer_id, inbox_key)
      );
    `);
    await installPostgresWarehouseSchema(connection.pool);
    await installPostgresFactSchema(connection.pool, descriptor);
    await installPostgresQuarantineSchema(connection.pool);
  }, 180_000);

  beforeEach(async () => {
    sequence = 0;
    await connection.pool.query(
      `TRUNCATE example_payments,croco_outbox_messages,croco_inbox_records,etl_event_quarantine,warehouse_receipts,warehouse_candidates,warehouse_heads,warehouse_mutations,"${table}" CASCADE`,
    );
  });

  afterAll(async () => {
    await dispose?.();
  });

  function setup() {
    const tenant = randomUUID();
    let clock = instant;
    const access: WarehouseAccess = {
      scope: { application: "outbox-fact-test", environment: "test", tenant },
      actor: "server-payment-service",
      roles: ["read", "import"],
      columns: Object.keys(descriptor.columns),
      permissionEpoch: 0,
      privacyEpoch: 0,
    };
    const db = drizzle(connection.pool);
    const txManager = new TxManager<DrizzleTransactionalEventStoreDb>(
      createDrizzleTxAdapter(db as never) as unknown as TxAdapter<DrizzleTransactionalEventStoreDb>,
    );
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
      txManager,
    });
    const outbox = new TransactionalOutbox({
      store,
      txManager,
      now: () => instant,
      idFactory: () => `message-${++sequence}`,
    });
    const catalog = new PostgresWarehouseCatalog(connection.pool, descriptor, () => access);
    const writer = new PostgresWarehouseWriter(connection.pool, descriptor, () => access);
    const quarantine = new PostgresQuarantineStore(connection.pool);

    async function candidate() {
      return catalog.createCandidate({
        access,
        id: randomUUID(),
        transformHash: "payment-projection-v1",
        sourceRefs: ["payments"],
        expectedHead: null,
        partitionSelection: null,
        audit: {
          reason: "stage payment events",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        },
      });
    }

    async function append(event: PaymentRecorded) {
      return txManager.run(async () => {
        const client = txManager.getClient() as typeof db;
        await client.execute(
          sql`INSERT INTO example_payments (id,kind,amount) VALUES (${event.operationId},${event.operationKind},${event.amount})`,
        );
        return outbox.append(event, {
          aggregateId: event.captureId,
          idempotencyKey: event.operationId,
        });
      });
    }

    function consumer(
      candidateId: string,
      fence: number,
      consumerStore = store,
      targetWriter: WarehouseWriter = writer,
    ) {
      return new AnalyticsOutboxConsumer({
        store: consumerStore,
        consumerId: "payment-analytics-v1",
        sourceRef: "payments",
        writer: targetWriter,
        quarantine,
        now: () => clock,
        visibilityTimeoutMs: 1_000,
        resolveBinding: async () => ({ access, candidateId, fence }),
        mapRows: async (envelope, message) => {
          const payload = message.payload;
          if (
            typeof payload.provider !== "string" ||
            typeof payload.operationId !== "string" ||
            (payload.operationKind !== "capture" && payload.operationKind !== "refund") ||
            typeof payload.captureId !== "string" ||
            typeof payload.amount !== "string"
          )
            throw new EtlEventProblem("etl-events-tx/invalid-fact");
          return [
            validateRow(descriptor, {
              provider: payload.provider,
              operationId: payload.operationId,
              operationKind: payload.operationKind,
              captureId: payload.captureId,
              sourceEventId: envelope.eventId,
              amount: payload.amount,
              currency: "USD",
              occurredAt: envelope.occurredAt,
            }),
          ];
        },
      });
    }

    return {
      access,
      append,
      candidate,
      consumer,
      db,
      outbox,
      store,
      txManager,
      writer,
      now: () => clock,
      advance: (milliseconds: number) => {
        clock = new Date(clock.getTime() + milliseconds);
      },
    };
  }

  async function factTotals() {
    const result = await connection.pool.query<{ count: string; amount: string }>(
      `SELECT COUNT(*)::text AS count,COALESCE(SUM(c_0),0)::text AS amount FROM "${table}"`,
    );
    return result.rows[0];
  }

  it("rolls back the domain write and source event together", async () => {
    const app = setup();
    const event = new PaymentRecorded(
      "provider-a",
      "capture-rollback",
      "capture",
      "capture-rollback",
      "10",
    );
    await expect(
      app.txManager.run(async () => {
        const client = app.txManager.getClient() as typeof app.db;
        await client.execute(
          sql`INSERT INTO example_payments (id,kind,amount) VALUES (${event.operationId},${event.operationKind},${event.amount})`,
        );
        await app.outbox.append(event, {
          aggregateId: event.captureId,
          idempotencyKey: event.operationId,
        });
        throw new Error("roll back domain transaction");
      }),
    ).rejects.toThrow("roll back domain transaction");
    const domain = await connection.pool.query("SELECT id FROM example_payments");
    const outbox = await connection.pool.query("SELECT id FROM croco_outbox_messages");
    expect(domain.rows).toHaveLength(0);
    expect(outbox.rows).toHaveLength(0);
  });

  it("loads confirmed capture and separate refund asynchronously without duplicating facts", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    await app.append(new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"));
    await app.append(new PaymentRecorded("provider-a", "refund-1", "refund", "capture-1", "20"));
    expect((await factTotals())?.count).toBe("0");

    const relay = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
    });
    expect((await relay.publishBatch({ limit: 10 })).claimed).toBe(1);
    expect((await relay.publishBatch({ limit: 10 })).claimed).toBe(1);
    expect((await factTotals())?.count).toBe("2");
    expect((await factTotals())?.amount).toBe("120");
    const receiptCount = await connection.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM warehouse_receipts",
    );
    expect(receiptCount.rows[0]?.count).toBe("2");
  });

  it("reuses the durable fact after inbox acknowledgement fails", async () => {
    const app = setup();
    const staged = await app.candidate();
    await app.append(new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"));
    let loseAck = true;
    const faultStore = new Proxy(app.store, {
      get(target, key) {
        if (key === "markInboxProcessed") {
          return async (...args: Parameters<typeof target.markInboxProcessed>) => {
            if (loseAck) {
              loseAck = false;
              throw new Error("inbox acknowledgement lost");
            }
            return target.markInboxProcessed(...args);
          };
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const consumer = app.consumer(staged.id, staged.fence, faultStore);
    const relay = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
      visibilityTimeoutMs: 1_000,
      retry: { baseDelayMs: 1, multiplier: 1, maxDelayMs: 1 },
    });
    const first = await relay.publishBatch({ limit: 1 });
    expect(first.scheduledRetry).toBe(1);
    expect((await factTotals())?.count).toBe("1");
    app.advance(2_000);
    const second = await relay.publishBatch({ limit: 1 });
    expect(second.published).toBe(1);
    expect((await factTotals())?.count).toBe("1");
    const receipts = await connection.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM warehouse_receipts",
    );
    expect(receipts.rows[0]?.count).toBe("1");
  });

  it("reuses the independent inbox decision after relay acknowledgement fails", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    const message = await app.append(
      new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"),
    );
    const acknowledgementError = new Error("relay acknowledgement lost");
    let loseAck = true;
    const relayStore = new Proxy(app.store, {
      get(target, key) {
        if (key === "markOutboxPublished") {
          return async (...args: Parameters<typeof target.markOutboxPublished>) => {
            if (loseAck) {
              loseAck = false;
              throw acknowledgementError;
            }
            return target.markOutboxPublished(...args);
          };
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const relay = new TransactionalOutboxRelay({
      store: relayStore,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
      visibilityTimeoutMs: 1_000,
      retry: { baseDelayMs: 1, multiplier: 1, maxDelayMs: 1 },
    });
    await expect(relay.publishBatch({ limit: 1 })).rejects.toBe(acknowledgementError);
    expect(await app.store.findOutboxById(message.id)).toMatchObject({
      status: "publishing",
      attempts: 1,
    });
    const inbox = await connection.pool.query<{ status: string }>(
      "SELECT status FROM croco_inbox_records WHERE consumer_id='payment-analytics-v1'",
    );
    expect(inbox.rows[0]?.status).toBe("processed");
    app.advance(999);
    const restarted = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        expect((await consumer.handle(message)).status).toBe("duplicate");
      },
      now: app.now,
      visibilityTimeoutMs: 1_000,
    });
    expect((await restarted.publishBatch({ limit: 1 })).claimed).toBe(0);
    app.advance(1);
    expect((await restarted.publishBatch({ limit: 1 })).published).toBe(1);
    expect((await factTotals())?.count).toBe("1");
  });

  it("preserves other consumer delivery and does not change the shared outbox status directly", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    const message = await app.append(
      new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"),
    );
    expect((await consumer.handle(message)).status).toBe("accepted-durable");
    const other = new TransactionalInboxConsumer({
      store: app.store,
      consumerId: "audit-v1",
      now: app.now,
    });
    expect((await other.handle(message, async () => {})).status).toBe("processed");
    expect((await app.store.findOutboxById(message.id))?.status).toBe("pending");
    const rows = await connection.pool.query<{ consumer_id: string; status: string }>(
      "SELECT consumer_id,status FROM croco_inbox_records ORDER BY consumer_id",
    );
    expect(rows.rows).toEqual([
      { consumer_id: "audit-v1", status: "processed" },
      { consumer_id: "payment-analytics-v1", status: "processed" },
    ]);
  });

  it("does not skip a lower-ID event that commits after a higher-ID event", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    let entered: (() => void) | undefined;
    let release: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lateEvent = new PaymentRecorded(
      "provider-a",
      "capture-late",
      "capture",
      "capture-late",
      "10",
    );
    const pending = app.txManager.run(async () => {
      const client = app.txManager.getClient() as typeof app.db;
      await client.execute(
        sql`INSERT INTO example_payments(id,kind,amount) VALUES (${lateEvent.operationId},'capture',10)`,
      );
      await app.outbox.append(lateEvent, {
        id: "a-lower-id",
        aggregateId: "capture-late",
        idempotencyKey: lateEvent.operationId,
      });
      entered?.();
      await held;
    });
    await waiting;
    const earlyEvent = new PaymentRecorded(
      "provider-a",
      "capture-early",
      "capture",
      "capture-early",
      "20",
    );
    await app.txManager.run(async () => {
      const client = app.txManager.getClient() as typeof app.db;
      await client.execute(
        sql`INSERT INTO example_payments(id,kind,amount) VALUES (${earlyEvent.operationId},'capture',20)`,
      );
      await app.outbox.append(earlyEvent, {
        id: "z-higher-id",
        aggregateId: "capture-early",
        idempotencyKey: earlyEvent.operationId,
      });
    });
    const relay = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
    });
    expect((await relay.publishBatch({ limit: 10 })).published).toBe(1);
    release?.();
    await pending;
    expect((await relay.publishBatch({ limit: 10 })).published).toBe(1);
    expect((await factTotals())?.count).toBe("2");
  });

  it("fences an expired consumer whose warehouse write completes after the new claim", async () => {
    const app = setup();
    const staged = await app.candidate();
    const message = await app.append(
      new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"),
    );
    let entered: (() => void) | undefined;
    let release: (() => void) | undefined;
    const writing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowWriter = {
      write: async (request: Parameters<typeof app.writer.write>[0]) => {
        entered?.();
        await held;
        return app.writer.write(request);
      },
      reconcileReceipt: app.writer.reconcileReceipt.bind(app.writer),
    };
    const stale = app.consumer(staged.id, staged.fence, app.store, slowWriter).handle(message);
    await writing;
    app.advance(2_000);
    expect((await app.consumer(staged.id, staged.fence).handle(message)).status).toBe(
      "accepted-durable",
    );
    release?.();
    await expect(stale).rejects.toThrow();
    expect((await factTotals())?.count).toBe("1");
    const inbox = await connection.pool.query<{ attempts: number; status: string }>(
      "SELECT attempts,status FROM croco_inbox_records WHERE consumer_id='payment-analytics-v1'",
    );
    expect(inbox.rows[0]).toEqual({ attempts: 2, status: "processed" });
  });

  it("durably quarantines malformed and conflicting facts without blocking another aggregate", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    const malformed = new PaymentRecorded(
      "provider-a",
      "malformed-capture",
      "capture",
      "malformed-capture",
      "10",
    );
    malformed.metadata = { analytics: { sourceRef: "wrong-source" } };
    await app.txManager.run(() =>
      app.outbox.append(malformed, {
        id: "malformed-message",
        aggregateId: "malformed-capture",
        idempotencyKey: "malformed-capture",
      }),
    );
    await app.append(new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"));
    const conflict = new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "200");
    await app.txManager.run(() =>
      app.outbox.append(conflict, {
        id: "z-conflict-message",
        aggregateId: "capture-1",
        idempotencyKey: "capture-1-conflict",
      }),
    );
    const relay = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
    });
    for (let index = 0; index < 3; index++) {
      expect((await relay.publishBatch({ limit: 1 })).published).toBe(1);
    }
    expect((await factTotals())?.count).toBe("1");
    expect((await factTotals())?.amount).toBe("100");
    const quarantine = await connection.pool.query<{ code: string }>(
      "SELECT code FROM etl_event_quarantine ORDER BY outbox_message_id",
    );
    expect(quarantine.rows).toEqual([
      { code: "etl-events-tx/invalid-source-envelope" },
      { code: "WAREHOUSE_FACT_CONFLICT" },
    ]);
  });

  it("keeps a confirmed domain command and retries after a warehouse outage", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    await app.append(new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"));
    await connection.pool.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT reject_fact_write CHECK (false)`,
    );
    const relay = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
      retry: { baseDelayMs: 1, multiplier: 1, maxDelayMs: 1 },
    });
    try {
      const failed = await relay.publishBatch({ limit: 1 });
      expect(failed.scheduledRetry).toBe(1);
      expect((await factTotals())?.count).toBe("0");
      const domain = await connection.pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM example_payments",
      );
      expect(domain.rows[0]?.count).toBe("1");
    } finally {
      await connection.pool.query(`ALTER TABLE "${table}" DROP CONSTRAINT reject_fact_write`);
    }
    app.advance(2_000);
    const restarted = new TransactionalOutboxRelay({
      store: app.store,
      publish: async (message) => {
        await consumer.handle(message);
      },
      now: app.now,
    });
    expect((await restarted.publishBatch({ limit: 1 })).published).toBe(1);
    expect((await factTotals())?.count).toBe("1");
  });

  it("reports deleted source history unavailable without reconstructing it from domain state", async () => {
    const app = setup();
    const staged = await app.candidate();
    const consumer = app.consumer(staged.id, staged.fence);
    const message = await app.append(
      new PaymentRecorded("provider-a", "capture-1", "capture", "capture-1", "100"),
    );
    await connection.pool.query("DELETE FROM croco_outbox_messages WHERE id=$1", [message.id]);
    const replay = await consumer.replayById(message.id, {
      kind: "outbox",
      knownHistoryFrom: "2026-09-01T00:00:00.000Z",
      retainedFrom: "2026-09-28T00:00:00.000Z",
    });
    expect(replay.status).toBe("unavailable");
    expect((await factTotals())?.count).toBe("0");
    const domain = await connection.pool.query("SELECT id FROM example_payments");
    expect(domain.rows).toHaveLength(1);
  });
});
