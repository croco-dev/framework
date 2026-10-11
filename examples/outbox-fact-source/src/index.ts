import { randomUUID } from "node:crypto";

import { DomainEvent } from "@croco/events-core";
import {
  DrizzleTransactionalEventStore,
  TransactionalOutbox,
  TransactionalOutboxRelay,
  type DrizzleTransactionalEventStoreDb,
} from "@croco/events-tx";
import { AnalyticsOutboxConsumer, EtlEventProblem } from "@croco/etl-events-tx";
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
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { WarehouseAccess } from "@croco/warehouse-core/runtime";

const connectionString = process.env.OUTBOX_FACT_DATABASE_URL;
if (!connectionString) {
  throw new Error("Set OUTBOX_FACT_DATABASE_URL to a disposable PostgreSQL database.");
}

const fact = defineFact("example_payment_event", {
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

class PaymentEvent extends DomainEvent {
  static eventName = "example.payment-confirmed";

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
        sourceRef: "confirmed-payments",
        schemaVersion: 1,
        subject: captureId,
        origin: "example-payment-service",
      },
    };
  }
}

async function installDomainAndEventSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS example_payment_commands (
      id text PRIMARY KEY,
      kind text NOT NULL,
      amount bigint NOT NULL
    );
    CREATE TABLE IF NOT EXISTS croco_outbox_messages (
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
    CREATE TABLE IF NOT EXISTS croco_inbox_records (
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
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString, max: 4 });
  try {
    const descriptor = await compileFact(fact);
    await installDomainAndEventSchema(pool);
    await installPostgresWarehouseSchema(pool);
    await installPostgresFactSchema(pool, descriptor);
    await installPostgresQuarantineSchema(pool);

    const access: WarehouseAccess = {
      scope: { application: "outbox-fact-example", environment: "local", tenant: "demo" },
      actor: "example-payment-service",
      roles: ["read", "import"],
      columns: Object.keys(descriptor.columns),
      permissionEpoch: 0,
      privacyEpoch: 0,
    };
    const catalog = new PostgresWarehouseCatalog(pool, descriptor, () => access);
    const candidate = await catalog.createCandidate({
      access,
      id: randomUUID(),
      transformHash: "payment-event-projection-v1",
      sourceRefs: ["confirmed-payments"],
      expectedHead: null,
      partitionSelection: null,
      audit: {
        reason: "stage confirmed payment events",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const db = drizzle(pool);
    const txManager = new TxManager<DrizzleTransactionalEventStoreDb>(
      createDrizzleTxAdapter(db as never) as unknown as TxAdapter<DrizzleTransactionalEventStoreDb>,
    );
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
      txManager,
    });
    const outbox = new TransactionalOutbox({ store, txManager });
    const consumer = new AnalyticsOutboxConsumer({
      store,
      consumerId: "payment-analytics-v1",
      sourceRef: "confirmed-payments",
      writer: new PostgresWarehouseWriter(pool, descriptor, () => access),
      quarantine: new PostgresQuarantineStore(pool),
      resolveBinding: async () => ({ access, candidateId: candidate.id, fence: candidate.fence }),
      mapRows: async (envelope, message) => {
        const value = message.payload;
        if (
          typeof value.provider !== "string" ||
          typeof value.operationId !== "string" ||
          (value.operationKind !== "capture" && value.operationKind !== "refund") ||
          typeof value.captureId !== "string" ||
          typeof value.amount !== "string"
        ) {
          throw new EtlEventProblem("etl-events-tx/invalid-fact");
        }
        return [
          validateRow(descriptor, {
            provider: value.provider,
            operationId: value.operationId,
            operationKind: value.operationKind,
            captureId: value.captureId,
            sourceEventId: envelope.eventId,
            amount: value.amount,
            currency: "USD",
            occurredAt: envelope.occurredAt,
          }),
        ];
      },
    });

    const captureId = randomUUID();
    const events = [
      new PaymentEvent("provider-demo", captureId, "capture", captureId, "1200"),
      new PaymentEvent("provider-demo", randomUUID(), "refund", captureId, "300"),
    ];
    for (const event of events) {
      await txManager.run(async () => {
        const client = txManager.getClient() as typeof db;
        await client.execute(
          sql`INSERT INTO example_payment_commands(id,kind,amount)
              VALUES(${event.operationId},${event.operationKind},${event.amount})`,
        );
        await outbox.append(event, {
          aggregateId: captureId,
          idempotencyKey: event.operationId,
        });
      });
    }

    const relay = new TransactionalOutboxRelay({
      store,
      publish: async (message) => {
        await consumer.handle(message);
      },
    });
    await relay.publishBatch({ limit: 10 });
    await relay.publishBatch({ limit: 10 });

    const table = `wh_fact_${descriptor.semanticHash.slice(0, 48)}`;
    const facts = await pool.query<{ count: string; amount: string }>(
      `SELECT COUNT(*)::text AS count, SUM(c_0)::text AS amount FROM "${table}"`,
    );
    const domain = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM example_payment_commands",
    );
    const outboxState = await pool.query<{ status: string }>(
      "SELECT status FROM croco_outbox_messages WHERE idempotency_key=$1",
      [captureId],
    );
    console.log(
      JSON.stringify({
        domainCommands: domain.rows[0]?.count,
        acceptedFacts: facts.rows[0]?.count,
        acceptedAmountMinor: facts.rows[0]?.amount,
        candidate: candidate.id,
        publication: "not published; source coverage has not been independently closed",
        outboxState: outboxState.rows[0]?.status ?? "see croco_outbox_messages",
      }),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
