import { ProblemFactory } from "@croco/problems-core";
import { sql } from "drizzle-orm";

export type MeteringMigrationClient = {
  execute(query: unknown): Promise<unknown>;
  transaction?<T>(fn: (tx: MeteringMigrationClient) => Promise<T>): Promise<T>;
};

/**
 * PostgreSQL usage records에 typed usage envelope 컬럼과 event ID 조회 인덱스를 추가합니다.
 *
 * 이 helper는 인덱스를 transaction 안에서 생성하므로 대규모 `usage_records` 테이블에서는 쓰기를
 * 차단할 수 있습니다. 그런 환경에서는 컬럼 변경을 먼저 적용한 뒤 아래 인덱스를 transaction 밖에서
 * 별도 실행하세요.
 *
 * `CREATE INDEX CONCURRENTLY IF NOT EXISTS usage_records_event_id_idx
 * ON usage_records (tenant_id, event_id) WHERE event_id IS NOT NULL`
 */
export async function addUsageEnvelopeFieldsPostgres(db: MeteringMigrationClient): Promise<void> {
  await runMigration(db, async (tx) => {
    await tx.execute(sql`ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS event_id TEXT`);
    await tx.execute(sql`ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS dimensions JSONB`);
    await tx.execute(
      sql`CREATE INDEX IF NOT EXISTS usage_records_event_id_idx
          ON usage_records (tenant_id, event_id)
          WHERE event_id IS NOT NULL`,
    );
  });
}

/**
 * PostgreSQL usage records에서 typed usage envelope 컬럼을 제거합니다.
 *
 * 이 작업은 `event_id`와 `dimensions` 데이터를 영구 삭제하며 롤백할 수 없습니다. 실행 전에 백업하세요.
 */
export async function removeUsageEnvelopeFieldsPostgres(
  db: MeteringMigrationClient,
): Promise<void> {
  await runMigration(db, async (tx) => {
    await tx.execute(sql`DROP INDEX IF EXISTS usage_records_event_id_idx`);
    await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN IF EXISTS dimensions`);
    await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN IF EXISTS event_id`);
  });
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
    await tx.execute(
      sql`CREATE INDEX IF NOT EXISTS usage_records_event_id_idx
          ON usage_records (tenant_id, event_id)
          WHERE event_id IS NOT NULL`,
    );
  });
}

/**
 * SQLite usage records에서 typed usage envelope 컬럼을 제거합니다.
 *
 * 이 작업은 `event_id`와 `dimensions` 데이터를 영구 삭제하며 롤백할 수 없습니다. 실행 전에 백업하세요.
 * `ALTER TABLE ... DROP COLUMN`을 사용하므로 SQLite 3.35.0 이상이 필요합니다.
 *
 * `transaction`을 제공하면 schema 검사와 변경을 한 transaction에서 실행합니다.
 * MigrationRunner처럼 이미 transaction-scoped client를 전달하는 호출자는 `execute`만 제공할 수 있습니다.
 */
export async function removeUsageEnvelopeFieldsSqlite(db: MeteringMigrationClient): Promise<void> {
  await runSqliteMigration(db, async (tx, columns) => {
    await tx.execute(sql`DROP INDEX IF EXISTS usage_records_event_id_idx`);
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
  await runMigration(db, async (tx) => {
    const result = await tx.execute(sql`PRAGMA table_info('usage_records')`);
    const rows = getResultRows(result);
    const columns = new Set(
      rows
        .map((row) => (isRecord(row) ? row.name : undefined))
        .filter((name): name is string => typeof name === "string"),
    );
    await migrate(tx, columns);
  });
}

async function runMigration(
  db: MeteringMigrationClient,
  migrate: (tx: MeteringMigrationClient) => Promise<void>,
): Promise<void> {
  if (db.transaction) {
    await db.transaction(migrate);
    return;
  }

  await migrate(db);
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
