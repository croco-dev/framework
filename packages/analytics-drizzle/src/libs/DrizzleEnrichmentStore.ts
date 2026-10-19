import { sql } from "drizzle-orm";
import { EnrichmentProblem, enrichmentScopeKey } from "@croco/analytics-core/enrichment";
import type {
  EnrichmentRun,
  EnrichmentScope,
  EnrichmentStore,
} from "@croco/analytics-core/enrichment";
import type { FactHistoryDatabase } from "./DrizzleFactHistoryStore";

/** PostgreSQL run-local CAS and cross-run immutable input receipts. */
export class DrizzleEnrichmentStore implements EnrichmentStore {
  constructor(private readonly db: FactHistoryDatabase) {}
  async create(run: EnrichmentRun): Promise<EnrichmentRun> {
    return this.execute(() =>
      this.db.transaction(async (tx) => {
        if (run.revision !== 0) throw new EnrichmentProblem("invalid-revision");
        const scope = enrichmentScopeKey(run.scope);
        await tx.execute(sql`INSERT INTO analytics_enrichment_runs(scope_key,run_id,revision,run_data)
        VALUES (${scope},${run.runId},0,${JSON.stringify(run)}::jsonb)
        ON CONFLICT (scope_key,run_id) DO NOTHING`);
        const existing = await tx.execute(
          sql`SELECT run_data FROM analytics_enrichment_runs WHERE scope_key=${scope} AND run_id=${run.runId}`,
        );
        const stored = existing.rows[0]?.run_data as EnrichmentRun | undefined;
        if (!stored) throw new EnrichmentProblem("not-found");
        if (stored.fingerprint !== run.fingerprint) throw new EnrichmentProblem("input-conflict");
        const sorted = [...run.items].sort((left, right) => {
          const a = JSON.stringify([left.input.itemId, left.input.inputRevision]);
          const b = JSON.stringify([right.input.itemId, right.input.inputRevision]);
          return a < b ? -1 : a > b ? 1 : 0;
        });
        for (const item of sorted) {
          await tx.execute(sql`INSERT INTO analytics_enrichment_inputs(scope_key,item_id,input_revision,source_hash)
          VALUES (${scope},${item.input.itemId},${item.input.inputRevision},${item.sourceHash})
          ON CONFLICT (scope_key,item_id,input_revision) DO NOTHING`);
          const receipt = await tx.execute(sql`SELECT source_hash FROM analytics_enrichment_inputs
          WHERE scope_key=${scope} AND item_id=${item.input.itemId} AND input_revision=${item.input.inputRevision} FOR UPDATE`);
          if (receipt.rows[0]?.source_hash !== item.sourceHash)
            throw new EnrichmentProblem("input-conflict");
        }
        return stored;
      }),
    );
  }
  async load(scope: EnrichmentScope, runId: string): Promise<EnrichmentRun | null> {
    return this.execute(async () => {
      const result = await this.db.execute(
        sql`SELECT run_data FROM analytics_enrichment_runs WHERE scope_key=${enrichmentScopeKey(scope)} AND run_id=${runId}`,
      );
      return result.rows.length ? (result.rows[0].run_data as EnrichmentRun) : null;
    });
  }
  async compareAndSet(run: EnrichmentRun, expectedRevision: number): Promise<boolean> {
    return this.execute(async () => {
      if (run.revision !== expectedRevision + 1) throw new EnrichmentProblem("invalid-revision");
      const result = await this.db
        .execute(sql`UPDATE analytics_enrichment_runs SET revision=${run.revision},run_data=${JSON.stringify(run)}::jsonb
        WHERE scope_key=${enrichmentScopeKey(run.scope)} AND run_id=${run.runId} AND revision=${expectedRevision} RETURNING revision`);
      return result.rows.length === 1;
    });
  }
  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (cause) {
      if (cause instanceof EnrichmentProblem) throw cause;
      throw new EnrichmentProblem("persistence-failed", cause);
    }
  }
}
