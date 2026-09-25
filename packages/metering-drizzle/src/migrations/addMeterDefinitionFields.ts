import { sql } from "drizzle-orm";

import { DuplicateMeterDefinitionsProblem } from "../libs/problems/DuplicateMeterDefinitionsProblem";
import {
  getResultRows,
  isRecord,
  runMigration,
  runSqliteMigration,
  unsupportedMigrationQueryResult,
} from "./migrationSupport";
import type { MeteringMigrationClient } from "./migrationSupport";

/**
 * PostgreSQL meters에 `billing`, `aggregation`, `unit` 컬럼과 `(tenant_id, meter_id)` unique index를 추가합니다.
 *
 * 같은 `(tenant_id, meter_id)` 행이 여러 개 있으면 행을 삭제하지 않고 `DuplicateMeterDefinitionsProblem`으로
 * 중복 목록과 함께 실패합니다. `transaction`을 제공하면 컬럼 추가도 롤백됩니다.
 */
export async function addMeterDefinitionFieldsPostgres(db: MeteringMigrationClient): Promise<void> {
  await runMigration(db, async (tx) => {
    await tx.execute(
      sql`ALTER TABLE meters ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'local'`,
    );
    await tx.execute(sql`ALTER TABLE meters ADD COLUMN IF NOT EXISTS aggregation TEXT`);
    await tx.execute(sql`ALTER TABLE meters ADD COLUMN IF NOT EXISTS unit TEXT`);
    await addMeterDefinitionUniqueIndex(tx);
  });
}

/**
 * SQLite meters에 `billing`, `aggregation`, `unit` 컬럼과 `(tenant_id, meter_id)` unique index를 추가합니다.
 *
 * 중복 행 처리는 `addMeterDefinitionFieldsPostgres`와 같습니다. `execute`는 `PRAGMA`와 `SELECT`의 결과 행을
 * 반환해야 합니다.
 */
export async function addMeterDefinitionFieldsSqlite(db: MeteringMigrationClient): Promise<void> {
  await runSqliteMigration(db, "meters", async (tx, columns) => {
    if (!columns.has("billing")) {
      await tx.execute(sql`ALTER TABLE meters ADD COLUMN billing TEXT NOT NULL DEFAULT 'local'`);
    }
    if (!columns.has("aggregation")) {
      await tx.execute(sql`ALTER TABLE meters ADD COLUMN aggregation TEXT`);
    }
    if (!columns.has("unit")) {
      await tx.execute(sql`ALTER TABLE meters ADD COLUMN unit TEXT`);
    }
    await addMeterDefinitionUniqueIndex(tx);
  });
}

async function addMeterDefinitionUniqueIndex(tx: MeteringMigrationClient): Promise<void> {
  const duplicates = getResultRows(
    await tx.execute(sql`
      SELECT tenant_id, meter_id, CAST(COUNT(*) AS INTEGER) AS row_count
      FROM meters
      GROUP BY tenant_id, meter_id
      HAVING COUNT(*) > 1
      ORDER BY tenant_id, meter_id
    `),
  ).map(toDuplicateMeterDefinition);
  if (duplicates.length > 0) {
    throw new DuplicateMeterDefinitionsProblem(duplicates);
  }

  await tx.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS meters_tenant_meter_unique ON meters (tenant_id, meter_id)`,
  );
}

function toDuplicateMeterDefinition(row: unknown) {
  if (
    !isRecord(row) ||
    typeof row.tenant_id !== "string" ||
    typeof row.meter_id !== "string" ||
    typeof row.row_count !== "number"
  ) {
    throw unsupportedMigrationQueryResult();
  }

  return { tenantId: row.tenant_id, meterId: row.meter_id, rowCount: row.row_count };
}
