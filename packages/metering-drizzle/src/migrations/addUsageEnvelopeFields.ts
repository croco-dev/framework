import { sql } from "drizzle-orm";

import { runMigration, runSqliteMigration } from "./migrationSupport";
import type { MeteringMigrationClient } from "./migrationSupport";

export type { MeteringMigrationClient } from "./migrationSupport";

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
  await runSqliteMigration(db, "usage_records", async (tx, columns) => {
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
  await runSqliteMigration(db, "usage_records", async (tx, columns) => {
    await tx.execute(sql`DROP INDEX IF EXISTS usage_records_event_id_idx`);
    if (columns.has("dimensions")) {
      await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN dimensions`);
    }
    if (columns.has("event_id")) {
      await tx.execute(sql`ALTER TABLE usage_records DROP COLUMN event_id`);
    }
  });
}
