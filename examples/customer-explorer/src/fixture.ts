import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { CustomerExplorerService, explorerScopeKey } from "@croco/admin-core";
import { PostgresCustomerExplorerRepository, PostgresTimelineSource } from "@croco/admin-ops";
import type { ExplorerScope } from "@croco/admin-core";

const url = process.env.CUSTOMER_EXPLORER_DATABASE_URL;
if (!url)
  throw new Error(
    "CUSTOMER_EXPLORER_DATABASE_URL is required for the synthetic PostgreSQL example",
  );
export const scope: ExplorerScope = {
  appId: "customer-explorer",
  environment: "local",
  tenantId: "synthetic",
};
export const sampleId = "checkout-observation-v1";
export const pool = new Pool({
  connectionString: url,
  options: "-c search_path=customer_explorer_example",
});
const repository = new PostgresCustomerExplorerRepository(pool);
export const source = new PostgresTimelineSource({
  id: "normalized",
  executor: pool,
  mapping: {
    table: "customer_events",
    appId: "app_id",
    environment: "environment",
    tenantId: "tenant_id",
    subjectKind: "subject_kind",
    subjectId: "subject_id",
    eventId: "event_id",
    occurredAt: "occurred_at",
    observedAt: "observed_at",
    kind: "kind",
    safeProperties: "properties",
  },
  status: async () => "complete",
});
export const service = new CustomerExplorerService({
  repository,
  sources: [source],
  now: () => new Date().toISOString(),
  maxRetentionMs: 7 * 86400000,
  allowedProperties: { normalized: ["channel", "amount", "currency", "status", "label"] },
  authorization: {
    actor: "synthetic-operator",
    authorize: async (requested) => explorerScopeKey(requested) === explorerScopeKey(scope),
  },
});

export async function setup(): Promise<void> {
  const admin = new Pool({ connectionString: url });
  try {
    await admin.query("CREATE SCHEMA customer_explorer_example");
  } finally {
    await admin.end();
  }
  await pool.query(
    readFileSync(
      resolve(__dirname, "../../../packages/admin-ops/migrations/0001_customer_explorer.up.sql"),
      "utf8",
    ),
  );
  await pool.query(`CREATE TABLE customer_events (
    app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
    subject_kind text NOT NULL, subject_id text NOT NULL, event_id text NOT NULL,
    occurred_at timestamptz NOT NULL, observed_at timestamptz NOT NULL, kind text NOT NULL, properties jsonb NOT NULL,
    PRIMARY KEY(app_id,environment,tenant_id,subject_kind,subject_id,event_id))`);
  await pool.query(
    'CREATE INDEX customer_events_timeline ON customer_events(app_id,environment,tenant_id,subject_kind,subject_id,occurred_at,event_id COLLATE "C")',
  );
  const anchorAt = "2026-10-05T10:00:00.000Z";
  for (const id of ["busy-customer", "quiet-customer", "comparison-customer"]) {
    const events = [
      { kind: "message.sent", offset: -600000, properties: { channel: "email", status: "sent" } },
      {
        kind: "message.clicked",
        offset: -300000,
        properties: { channel: "email", label: "Autumn offer" },
      },
      ...(id === "comparison-customer"
        ? []
        : [
            {
              kind: "payment.confirmed",
              offset: 0,
              properties: { amount: 2400, currency: "USD", status: "server-confirmed" },
            },
            {
              kind: "payment.refunded",
              offset: 60000,
              properties: { amount: 2400, currency: "USD" },
            },
          ]),
      ...(id === "busy-customer"
        ? Array.from({ length: 1001 }, (_, index) => ({
            kind: "page.viewed",
            offset: 120000 + index * 1000,
            properties: { label: "Product details", email: "synthetic@example.invalid" },
          }))
        : []),
    ];
    for (const [index, event] of events.entries())
      await pool.query("INSERT INTO customer_events VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
        scope.appId,
        scope.environment,
        scope.tenantId,
        "customer",
        id,
        String(index).padStart(6, "0"),
        new Date(Date.parse(anchorAt) + event.offset).toISOString(),
        new Date(Date.parse(anchorAt) + event.offset + 1000).toISOString(),
        event.kind,
        JSON.stringify(event.properties),
      ]);
  }
  await service.sample(
    {
      scope,
      seed: "checkout-v1",
      populationSnapshotId: "synthetic-population-v1",
      targetDefinition: {
        id: "confirmed-checkout",
        revision: 1,
        description: "Server-confirmed checkout compared with the preceding click step",
      },
      window: { beforeMs: 3600000, afterMs: 3600000 },
      achieverCount: 2,
      comparisonCount: 1,
    },
    {
      scope,
      snapshotId: "synthetic-population-v1",
      achievers: ["busy-customer", "quiet-customer"].map((id) => ({
        subject: { kind: "customer", id },
        anchorAt,
      })),
      comparisons: [{ subject: { kind: "customer", id: "comparison-customer" }, anchorAt }],
    },
    { id: sampleId, expiresAt: new Date(Date.now() + 7 * 86400000 - 1000).toISOString() },
  );
}
