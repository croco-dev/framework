import { persistenceFailure } from "./persistenceFailure";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  canonicalFactValue,
  FactHistoryProblem,
  factProjectionKey,
  factScopeKey,
  factSubjectKey,
} from "@croco/analytics-core";
import type {
  AppendFactsInput,
  AppendFactsResult,
  FactHistoryQuery,
  FactHistoryStore,
  FactProjection,
  FactRow,
  FactScope,
  FactSubject,
} from "@croco/analytics-core";
import type { SQL } from "drizzle-orm";

export interface FactHistoryConnection {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface FactHistoryDatabase extends FactHistoryConnection {
  transaction<T>(callback: (tx: FactHistoryConnection) => Promise<T>): Promise<T>;
}

/** PostgreSQL atomic receipt + projection persistence. All scope mutations share a row lock. */
export class DrizzleFactHistoryStore implements FactHistoryStore {
  constructor(private readonly db: FactHistoryDatabase) {}

  async appendFacts(input: AppendFactsInput, recordedAt: string): Promise<AppendFactsResult> {
    if (new Set(input.rows.map((row) => row.materializationRevision)).size !== 1)
      throw new FactHistoryProblem(
        "invalid-input",
        "Atomic batch rows must share one materialization revision",
      );
    return this.db
      .transaction(async (tx) => {
        const scope = factScopeKey(input.scope);
        const revision = await lockScope(tx, scope);
        for (const row of input.rows) await assertLive(tx, scope, factSubjectKey(row.subject));
        const receipt = await tx.execute(sql`SELECT fingerprint FROM analytics_fact_receipts
        WHERE scope_key=${scope} AND source=${input.source} AND source_event_id=${input.sourceEventId}`);
        if (receipt.rows.length && receipt.rows[0].fingerprint !== input.sourceFingerprint)
          throw new FactHistoryProblem(
            "source-conflict",
            "Source fingerprint differs from the accepted receipt",
          );
        const keys = input.rows.map(factProjectionKey).sort();
        if (new Set(keys).size !== keys.length)
          throw new FactHistoryProblem("projection-conflict", "Duplicate projection identity");
        const generation = JSON.stringify([input.rows[0].materializationRevision]);
        const projectionSet = createHash("sha256").update(JSON.stringify(keys)).digest("hex");
        const batch =
          await tx.execute(sql`SELECT projection_set,revision FROM analytics_fact_batches
        WHERE scope_key=${scope} AND source=${input.source} AND source_event_id=${input.sourceEventId}
        AND generation_key=${generation}`);
        if (batch.rows.length && batch.rows[0].projection_set !== projectionSet)
          throw new FactHistoryProblem(
            "projection-conflict",
            "Expected projection set changed within a generation",
          );
        const existing: FactRow[] = [];
        for (const row of input.rows) {
          const found =
            await tx.execute(sql`SELECT row_data FROM analytics_fact_history WHERE scope_key=${scope}
          AND source=${input.source} AND source_event_id=${input.sourceEventId} AND projection_key=${factProjectionKey(row)}`);
          if (found.rows.length) {
            const stored = found.rows[0].row_data as FactRow;
            const {
              id: _id,
              scope: _scope,
              source: _source,
              sourceEventId: _event,
              recordedAt: _time,
              correction,
              ...projection
            } = stored;
            if (
              canonicalFactValue(normalizeProjection(projection)) !==
                canonicalFactValue(normalizeProjection(row)) ||
              canonicalFactValue(correction ?? null) !==
                canonicalFactValue(input.correction ?? null)
            )
              throw new FactHistoryProblem(
                "projection-conflict",
                "Projection identity has different content",
              );
            existing.push(stored);
          }
        }
        if (batch.rows.length) return { rows: existing, revision: Number(batch.rows[0].revision) };
        if (input.correction && input.correction.expectedRevision !== revision)
          throw new FactHistoryProblem("revision-conflict", "Scope revision changed");
        if (input.correction) {
          const prior =
            await tx.execute(sql`SELECT 1 FROM analytics_fact_batches WHERE scope_key=${scope}
          AND correction_key=${input.correction.idempotencyKey}`);
          if (prior.rows.length)
            throw new FactHistoryProblem(
              "projection-conflict",
              "Correction idempotency key is already used",
            );
        }
        for (const row of input.rows) {
          if (!row.supersedes) continue;
          const prior = await tx.execute(
            sql`SELECT row_data FROM analytics_fact_history WHERE scope_key=${scope} AND id=${row.supersedes}`,
          );
          const previous = prior.rows[0]?.row_data as FactRow | undefined;
          if (
            !input.correction ||
            !previous ||
            factSubjectKey(previous.subject) !== factSubjectKey(row.subject) ||
            previous.definitionId !== row.definitionId ||
            previous.definitionVersion !== row.definitionVersion ||
            previous.materializationRevision !== row.materializationRevision
          )
            throw new FactHistoryProblem(
              "invalid-input",
              "Correction must supersede a fact in the same subject and generation",
            );
        }
        await tx.execute(sql`INSERT INTO analytics_fact_receipts(scope_key,source,source_event_id,fingerprint)
        VALUES(${scope},${input.source},${input.sourceEventId},${input.sourceFingerprint}) ON CONFLICT DO NOTHING`);
        const rows = [...existing];
        for (const projection of input.rows) {
          if (existing.some((row) => factProjectionKey(row) === factProjectionKey(projection)))
            continue;
          const row: FactRow = {
            ...normalizeProjection(projection),
            id: randomUUID(),
            scope: input.scope,
            source: input.source,
            sourceEventId: input.sourceEventId,
            recordedAt,
            ...(input.correction ? { correction: input.correction } : {}),
          };
          await tx.execute(sql`INSERT INTO analytics_fact_history
          (id,scope_key,source,source_event_id,projection_key,subject_key,definition_id,definition_version,
          materialization_revision,valid_from,recorded_at,row_data)
          VALUES(${row.id},${scope},${input.source},${input.sourceEventId},${factProjectionKey(row)},${factSubjectKey(row.subject)},
          ${row.definitionId},${row.definitionVersion},${row.materializationRevision},${row.validFrom},${recordedAt},${JSON.stringify(row)}::jsonb)`);
          rows.push(row);
        }
        await tx.execute(
          sql`UPDATE analytics_fact_scopes SET revision=revision+1 WHERE scope_key=${scope}`,
        );
        await tx.execute(sql`INSERT INTO analytics_fact_batches
        (scope_key,source,source_event_id,generation_key,projection_set,correction_key,revision)
        VALUES(${scope},${input.source},${input.sourceEventId},${generation},${projectionSet},${input.correction?.idempotencyKey ?? null},${revision + 1})`);
        return { rows, revision: revision + 1 };
      })
      .catch(persistenceFailure);
  }

  async readHistory(input: FactHistoryQuery): Promise<readonly FactRow[]> {
    const scope = factScopeKey(input.scope);
    return this.db
      .transaction(async (tx) => {
        await lockScope(tx, scope);
        await assertLive(tx, scope, factSubjectKey(input.subject));
        const result =
          await tx.execute(sql`SELECT row_data FROM analytics_fact_history WHERE scope_key=${scope}
        AND subject_key=${factSubjectKey(input.subject)} AND definition_id=${input.definitionId}
        AND definition_version=${input.definitionVersion} AND materialization_revision=${input.materializationRevision}
        AND recorded_at <= ${input.knownAt}::timestamptz ORDER BY recorded_at,id LIMIT ${input.limit + 1}`);
        if (result.rows.length > input.limit)
          throw new FactHistoryProblem("history-limit", "History exceeds the requested bound");
        return result.rows.map((row) => row.row_data as FactRow);
      })
      .catch(persistenceFailure);
  }

  async getRevision(scope: FactScope): Promise<number> {
    const result = await this.db
      .execute(
        sql`SELECT revision FROM analytics_fact_scopes WHERE scope_key=${factScopeKey(scope)}`,
      )
      .catch(persistenceFailure);
    return result.rows.length ? Number(result.rows[0].revision) : 0;
  }

  async deleteSubject(scope: FactScope, subject: FactSubject): Promise<void> {
    await this.db
      .transaction(async (tx) => {
        const key = factScopeKey(scope);
        await lockScope(tx, key);
        await tx.execute(sql`INSERT INTO analytics_fact_deleted_subjects(scope_key,subject_key)
        VALUES(${key},${factSubjectKey(subject)}) ON CONFLICT DO NOTHING`);
        await tx.execute(
          sql`DELETE FROM analytics_fact_history WHERE scope_key=${key} AND subject_key=${factSubjectKey(subject)}`,
        );
        await tx.execute(
          sql`UPDATE analytics_fact_scopes SET revision=revision+1 WHERE scope_key=${key}`,
        );
      })
      .catch(persistenceFailure);
  }
}
function normalizeProjection(row: FactProjection): FactProjection {
  const { validTo, supersedes, ...required } = row;
  return {
    ...required,
    ...(validTo === undefined ? {} : { validTo }),
    ...(supersedes === undefined ? {} : { supersedes }),
  };
}
async function lockScope(tx: FactHistoryConnection, scope: string): Promise<number> {
  await tx.execute(
    sql`INSERT INTO analytics_fact_scopes(scope_key) VALUES(${scope}) ON CONFLICT DO NOTHING`,
  );
  const result = await tx.execute(
    sql`SELECT revision FROM analytics_fact_scopes WHERE scope_key=${scope} FOR UPDATE`,
  );
  return Number(result.rows[0].revision);
}
async function assertLive(
  tx: FactHistoryConnection,
  scope: string,
  subject: string,
): Promise<void> {
  const result = await tx.execute(
    sql`SELECT 1 FROM analytics_fact_deleted_subjects WHERE scope_key=${scope} AND subject_key=${subject}`,
  );
  if (result.rows.length)
    throw new FactHistoryProblem("deleted", "Subject history has been deleted");
}
