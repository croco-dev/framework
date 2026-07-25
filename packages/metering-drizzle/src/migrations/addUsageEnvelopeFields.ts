import { ProblemFactory } from "@croco/problems-core";
import { sql } from "drizzle-orm";

export type MeteringMigrationClient = {
  execute(query: unknown): Promise<unknown>;
  transaction?<T>(fn: (tx: MeteringMigrationClient) => Promise<T>): Promise<T>;
};

export async function addUsageEnvelopeFieldsPostgres(db: MeteringMigrationClient): Promise<void> {
  await db.execute(sql`ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS event_id TEXT`);
  await db.execute(sql`ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS dimensions JSONB`);
}

export async function removeUsageEnvelopeFieldsPostgres(
  db: MeteringMigrationClient,
): Promise<void> {
  await db.execute(sql`ALTER TABLE usage_records DROP COLUMN IF EXISTS dimensions`);
  await db.execute(sql`ALTER TABLE usage_records DROP COLUMN IF EXISTS event_id`);
}

/**
 * SQLite usage records에 typed usage envelope 컬럼을 추가합니다.
 *
 * `transaction`을 제공하면 schema 검사와 변경을 한 transaction에서 실행합니다.
 * MigrationRunner처럼 이미 transaction-scoped client를 전달하는 호출자는 `execute`만 제공할 수 있습니다.
 */
export async function addUsageEnvelopeFieldsSqlite(db: MeteringMigrationClient): Promise<void> {
  await runSqliteMigration(db, async (tx, columns) => {
    if (!columns.has("event_id")) {
      await tx.execute(sql`ALTER TABLE usage_records ADD COLUMN event_id TEXT`);
    }
    if (!columns.has("dimensions")) {
      await tx.execute(sql`ALTER TABLE usage_records ADD COLUMN dimensions TEXT`);
    }
  });
}

/**
 * SQLite usage records에서 typed usage envelope 컬럼을 제거합니다.
 *
 * `transaction`을 제공하면 schema 검사와 변경을 한 transaction에서 실행합니다.
 * MigrationRunner처럼 이미 transaction-scoped client를 전달하는 호출자는 `execute`만 제공할 수 있습니다.
 */
export async function removeUsageEnvelopeFieldsSqlite(db: MeteringMigrationClient): Promise<void> {
  await runSqliteMigration(db, async (tx, columns) => {
    if (columns.has("dimensions")) {
      await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN dimensions`);
    }
    if (columns.has("event_id")) {
      await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN event_id`);
    }
  });
}

async function runSqliteMigration(
  db: MeteringMigrationClient,
  migrate: (tx: MeteringMigrationClient, columns: ReadonlySet<string>) => Promise<void>,
): Promise<void> {
  const migrateInTransaction = async (tx: MeteringMigrationClient): Promise<void> => {
    const result = await tx.execute(sql`PRAGMA table_info('usage_records')`);
    const rows = getResultRows(result);
    const columns = new Set(
      rows
        .map((row) => (isRecord(row) ? row.name : undefined))
        .filter((name): name is string => typeof name === "string"),
    );
    await migrate(tx, columns);
  };

  if (db.transaction) {
    await db.transaction(migrateInTransaction);
    return;
  }

  await migrateInTransaction(db);
}

function getResultRows(result: unknown): readonly unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows;
  }

  throw ProblemFactory.internalServerError(
    "metering-drizzle/migration-query-result-unsupported",
    "SQLite migration schema inspection returned an unsupported result shape",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
