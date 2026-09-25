import { persistenceFailure } from "../libs/persistenceFailure";
import { sql } from "drizzle-orm";
import type { FactHistoryDatabase } from "../libs/DrizzleFactHistoryStore";

/** Apply before accepting history writes. Tables belong to this adapter. */
export async function createFactHistory(db: Pick<FactHistoryDatabase, "execute">): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_fact_scopes (
    scope_key text PRIMARY KEY, revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
  )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_fact_receipts (
    scope_key text NOT NULL REFERENCES analytics_fact_scopes(scope_key),
    source text NOT NULL, source_event_id text NOT NULL, fingerprint text NOT NULL,
    PRIMARY KEY(scope_key, source, source_event_id)
  )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_fact_batches (
    scope_key text NOT NULL, source text NOT NULL, source_event_id text NOT NULL,
    generation_key text NOT NULL, projection_set text NOT NULL, correction_key text,
    revision integer NOT NULL,
    PRIMARY KEY(scope_key, source, source_event_id, generation_key),
    UNIQUE(scope_key, correction_key),
    FOREIGN KEY(scope_key,source,source_event_id) REFERENCES analytics_fact_receipts
  )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_fact_history (
    id text PRIMARY KEY, scope_key text NOT NULL, source text NOT NULL, source_event_id text NOT NULL,
    projection_key text NOT NULL, subject_key text NOT NULL, definition_id text NOT NULL,
    definition_version text NOT NULL, materialization_revision text NOT NULL,
    valid_from timestamptz NOT NULL, recorded_at timestamptz NOT NULL,
    row_data jsonb NOT NULL,
    UNIQUE(scope_key, source, source_event_id, projection_key),
    FOREIGN KEY(scope_key,source,source_event_id) REFERENCES analytics_fact_receipts
  )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_fact_history_lookup ON analytics_fact_history
    (scope_key, subject_key, definition_id, definition_version, materialization_revision, recorded_at, valid_from)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_fact_deleted_subjects (
    scope_key text NOT NULL REFERENCES analytics_fact_scopes(scope_key), subject_key text NOT NULL,
    PRIMARY KEY(scope_key, subject_key)
  )`);
  } catch (cause) {
    persistenceFailure(cause);
  }
}

/** Destructively remove this adapter's history, receipts, and deletion tombstones. */
export async function dropFactHistory(db: Pick<FactHistoryDatabase, "execute">): Promise<void> {
  try {
    await db.execute(sql`DROP TABLE IF EXISTS analytics_fact_history`);
    await db.execute(sql`DROP TABLE IF EXISTS analytics_fact_batches`);
    await db.execute(sql`DROP TABLE IF EXISTS analytics_fact_receipts`);
    await db.execute(sql`DROP TABLE IF EXISTS analytics_fact_deleted_subjects`);
    await db.execute(sql`DROP TABLE IF EXISTS analytics_fact_scopes`);
  } catch (cause) {
    persistenceFailure(cause);
  }
}
