import { sql } from "drizzle-orm";
import { EnrichmentProblem } from "@croco/analytics-core/enrichment";
import type { FactHistoryConnection } from "../libs/DrizzleFactHistoryStore";

/** Explicit additive migration; never called by service startup. Existing fact history is untouched. */
export async function createEnrichment(db: FactHistoryConnection): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_enrichment_runs (
      scope_key text NOT NULL, run_id text NOT NULL, revision integer NOT NULL CHECK(revision >= 0),
      run_data jsonb NOT NULL CHECK(jsonb_typeof(run_data) = 'object'), PRIMARY KEY(scope_key,run_id)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_enrichment_inputs (
      scope_key text NOT NULL, item_id text NOT NULL, input_revision text NOT NULL,
      source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
      PRIMARY KEY(scope_key,item_id,input_revision)
    )`);
  } catch (cause) {
    throw new EnrichmentProblem("persistence-failed", cause);
  }
}
