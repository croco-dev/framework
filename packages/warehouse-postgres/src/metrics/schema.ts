import type { MetricsPostgresClient } from "./MetricsPostgresClient";

const METRICS_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS mrr_movements (
  id BIGSERIAL NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  event_key VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL,
  new_mrr_amount BIGINT NOT NULL,
  new_mrr_currency VARCHAR(3) NOT NULL,
  expansion_mrr_amount BIGINT NOT NULL,
  expansion_mrr_currency VARCHAR(3) NOT NULL,
  contraction_mrr_amount BIGINT NOT NULL,
  contraction_mrr_currency VARCHAR(3) NOT NULL,
  churned_mrr_amount BIGINT NOT NULL,
  churned_mrr_currency VARCHAR(3) NOT NULL,
  reactivation_mrr_amount BIGINT NOT NULL,
  reactivation_mrr_currency VARCHAR(3) NOT NULL,
  net_mrr_amount BIGINT NOT NULL,
  net_mrr_currency VARCHAR(3) NOT NULL,
  PRIMARY KEY (id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_mrr_movements_tenant_timestamp
  ON mrr_movements (tenant_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS mrr_movement_event_keys (
  tenant_id VARCHAR(255) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, event_key)
);

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id BIGSERIAL NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  snapshot_date DATE NOT NULL,
  total_mrr_amount BIGINT NOT NULL,
  total_mrr_currency VARCHAR(3) NOT NULL,
  active_customers INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, snapshot_date),
  UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_tenant_date
  ON metrics_snapshots (tenant_id, snapshot_date DESC);
`;

/**
 * Installs the legacy metrics tables on ordinary PostgreSQL without enabling TimescaleDB.
 * The caller retains ownership when the supplied client is already inside a transaction.
 */
export async function installPostgresMetricsSchema(db: MetricsPostgresClient): Promise<void> {
  await db.query(METRICS_TABLES_SQL);
}

/**
 * Installs the same legacy metrics layout and converts its time-series tables to TimescaleDB
 * hypertables. This function explicitly enables the extension; ordinary PostgreSQL consumers must
 * use `installPostgresMetricsSchema` instead. The caller retains ownership when the supplied client
 * is already inside a transaction.
 */
export async function installTimescaleMetricsSchema(db: MetricsPostgresClient): Promise<void> {
  await db.query(`
CREATE EXTENSION IF NOT EXISTS timescaledb;
${METRICS_TABLES_SQL}
SELECT create_hypertable(
  'mrr_movements',
  'timestamp',
  if_not_exists => TRUE,
  migrate_data => TRUE,
  chunk_time_interval => INTERVAL '1 month'
);
SELECT create_hypertable(
  'metrics_snapshots',
  'snapshot_date',
  if_not_exists => TRUE,
  migrate_data => TRUE,
  chunk_time_interval => INTERVAL '1 month'
);
`);
}

/**
 * Reconciles pre-event-key metrics tables before deploying the provider writer.
 *
 * Stop every old and new metrics writer before invoking this migration. The migration preserves all
 * rows, claims every existing event key, and keeps the existing table names and column meanings.
 * TimescaleDB conversion is intentionally separate so ordinary PostgreSQL installations never need
 * the extension. The caller retains ownership when the supplied client is already inside a
 * transaction.
 */
export async function migrateLegacyMetricsSchema(db: MetricsPostgresClient): Promise<void> {
  await db.query(`
LOCK TABLE mrr_movements IN ACCESS EXCLUSIVE MODE;
LOCK TABLE metrics_snapshots IN ACCESS EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS mrr_movement_event_keys (
  tenant_id VARCHAR(255) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, event_key)
);
INSERT INTO mrr_movement_event_keys (tenant_id, event_key)
SELECT tenant_id, event_key FROM mrr_movements WHERE event_key IS NOT NULL
ON CONFLICT (tenant_id, event_key) DO NOTHING;
DROP INDEX IF EXISTS uq_mrr_movements_tenant_event_key;
ALTER TABLE mrr_movements DROP CONSTRAINT IF EXISTS mrr_movements_pkey;
ALTER TABLE mrr_movements ADD PRIMARY KEY (id, timestamp);
ALTER TABLE metrics_snapshots DROP CONSTRAINT IF EXISTS metrics_snapshots_pkey;
ALTER TABLE metrics_snapshots ADD PRIMARY KEY (id, snapshot_date);
`);
}
