import { ProblemFactory } from "@croco/problems-core";
import { sql } from "drizzle-orm";

export type MeteringMigrationClient = {
  execute(query: unknown): Promise<unknown>;
  transaction?<T>(fn: (tx: MeteringMigrationClient) => Promise<T>): Promise<T>;
};

export async function runSqliteMigration(
  db: MeteringMigrationClient,
  table: "meters" | "usage_records",
  migrate: (tx: MeteringMigrationClient, columns: ReadonlySet<string>) => Promise<void>,
): Promise<void> {
  await runMigration(db, async (tx) => {
    const result = await tx.execute(sql`PRAGMA table_info(${sql.identifier(table)})`);
    const rows = getResultRows(result);
    const columns = new Set(
      rows
        .map((row) => (isRecord(row) ? row.name : undefined))
        .filter((name): name is string => typeof name === "string"),
    );
    await migrate(tx, columns);
  });
}

export async function runMigration(
  db: MeteringMigrationClient,
  migrate: (tx: MeteringMigrationClient) => Promise<void>,
): Promise<void> {
  if (db.transaction) {
    await db.transaction(migrate);
    return;
  }

  await migrate(db);
}

export function getResultRows(result: unknown): readonly unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows;
  }

  throw unsupportedMigrationQueryResult();
}

export function unsupportedMigrationQueryResult() {
  return ProblemFactory.internalServerError(
    "metering-drizzle/migration-query-result-unsupported",
    "Metering migration query returned an unsupported result shape",
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
