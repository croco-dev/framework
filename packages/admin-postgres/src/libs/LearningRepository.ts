import {
  LearningRegistryProblem,
  LearningStorageProblem,
  validateLearningCommit,
  explorerScopeKey,
} from "@croco/admin-core";
import type {
  LearningCommit,
  LearningRecord,
  LearningRepository,
  LearningRevision,
  LearningScope,
} from "@croco/admin-core";
import type { ExplorerPgDatabase, ExplorerPgExecutor } from "./CustomerExplorerAdapters";

const SCOPE = "app_id=$1 AND environment=$2 AND tenant_id=$3";
function values(scope: LearningScope): string[] {
  explorerScopeKey(scope);
  return [scope.appId, scope.environment, scope.tenantId];
}
async function transaction<T>(
  database: ExplorerPgDatabase,
  action: (client: ExplorerPgExecutor) => Promise<T>,
): Promise<T> {
  let client: Awaited<ReturnType<ExplorerPgDatabase["connect"]>> | undefined;
  try {
    client = await database.connect();
    await client.query("BEGIN");
    try {
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    if (error instanceof LearningRegistryProblem || error instanceof LearningStorageProblem)
      throw error;
    throw new LearningStorageProblem(error instanceof Error ? error : undefined);
  } finally {
    client?.release();
  }
}
/** Apply the packaged migration explicitly. Construction and reads never perform DDL. */
export class PostgresLearningRepository implements LearningRepository {
  constructor(private readonly database: ExplorerPgDatabase) {}
  private async query(
    text: string,
    parameters: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }> {
    try {
      return await this.database.query(text, parameters);
    } catch (error) {
      throw new LearningStorageProblem(error instanceof Error ? error : undefined);
    }
  }
  async commit(command: LearningCommit): Promise<LearningRecord> {
    const scoped = values(command.record.scope);
    return transaction(this.database, async (client) => {
      // One receipt lock across records detects key reuse, then one record lock serializes CAS.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        JSON.stringify(["learning-receipt", ...scoped, command.actor, command.idempotencyKey]),
      ]);
      const receipt = await client.query(
        `SELECT fingerprint,payload FROM croco_learning_receipts WHERE ${SCOPE} AND actor=$4 AND command_key=$5`,
        [...scoped, command.actor, command.idempotencyKey],
      );
      const prior = receipt.rows[0];
      if (prior) {
        if (prior.fingerprint !== command.fingerprint)
          throw new LearningRegistryProblem(
            "idempotency-conflict",
            "Idempotency key already names a different command",
          );
        return prior.payload as LearningRecord;
      }
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        JSON.stringify(["learning-record", ...scoped, command.record.id]),
      ]);
      const existing = await client.query(
        `SELECT payload FROM croco_learning_records WHERE ${SCOPE} AND id=$4 FOR UPDATE`,
        [...scoped, command.record.id],
      );
      validateLearningCommit(existing.rows[0]?.payload as LearningRecord | undefined, command);
      const saved: LearningRecord = { ...command.record, revision: command.expectedRevision + 1 };
      const payload = JSON.stringify(saved);
      const result =
        command.expectedRevision === 0
          ? await client.query(
              `INSERT INTO croco_learning_records(app_id,environment,tenant_id,id,revision,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
              [...scoped, saved.id, saved.revision, payload],
            )
          : await client.query(
              `UPDATE croco_learning_records SET revision=$5,payload=$6 WHERE ${SCOPE} AND id=$4 AND revision=$7 RETURNING id`,
              [...scoped, saved.id, saved.revision, payload, command.expectedRevision],
            );
      if (!result.rows.length)
        throw new LearningRegistryProblem("revision-conflict", "Learning revision changed");
      await client.query(
        `INSERT INTO croco_learning_history(app_id,environment,tenant_id,id,revision,payload,actor,reason,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [...scoped, saved.id, saved.revision, payload, command.actor, command.reason, command.at],
      );
      await client.query(
        `INSERT INTO croco_learning_receipts(app_id,environment,tenant_id,actor,command_key,fingerprint,payload) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [...scoped, command.actor, command.idempotencyKey, command.fingerprint, payload],
      );
      return saved;
    });
  }
  async read(scope: LearningScope, id: string): Promise<LearningRecord | undefined> {
    const result = await this.query(
      `SELECT payload FROM croco_learning_records WHERE ${SCOPE} AND id=$4`,
      [...values(scope), id],
    );
    return result.rows[0]?.payload as LearningRecord | undefined;
  }
  async page(
    scope: LearningScope,
    after: string | undefined,
    limit: number,
  ): Promise<readonly LearningRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 51)
      throw new LearningRegistryProblem("input", "Invalid repository page size");
    const result = await this.query(
      `SELECT payload FROM croco_learning_records WHERE ${SCOPE} AND ($4::text IS NULL OR id COLLATE "C">$4 COLLATE "C") ORDER BY id COLLATE "C" LIMIT $5`,
      [...values(scope), after ?? null, limit],
    );
    return result.rows.map((row) => row.payload as LearningRecord);
  }
  async history(
    scope: LearningScope,
    id: string,
    before: number | undefined,
    limit: number,
  ): Promise<readonly LearningRevision[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new LearningRegistryProblem("input", "Invalid repository history size");
    const result = await this.query(
      `SELECT payload,actor,reason,at FROM croco_learning_history WHERE ${SCOPE} AND id=$4 AND ($5::bigint IS NULL OR revision<$5) ORDER BY revision DESC LIMIT $6`,
      [...values(scope), id, before ?? null, limit],
    );
    return result.rows.map((row) => ({
      record: row.payload as LearningRecord,
      actor: String(row.actor),
      reason: String(row.reason),
      at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    }));
  }
}
