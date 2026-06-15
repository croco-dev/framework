import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./db-types";
import { UnsupportedMigrationQueryResultProblem } from "./problems/UnsupportedMigrationQueryResultProblem";
import type { MigrationRecord } from "./types";

export class MigrationStore {
  private readonly tableName: string;

  constructor(tableName = "_migrations") {
    this.tableName = tableName;
  }

  async ensureTable(db: DatabaseClient): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(this.tableName)} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getExecutedMigrations(db: DatabaseClient): Promise<MigrationRecord[]> {
    const result = await db.execute(sql`
      SELECT id, name, executed_at as executedAt
      FROM ${sql.identifier(this.tableName)}
      ORDER BY executed_at ASC
    `);

    const rows = getResultRows(result);

    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      executedAt: getExecutedAt(row),
    }));
  }

  async recordMigration(db: DatabaseClient, id: string, name: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO ${sql.identifier(this.tableName)} (id, name, executed_at)
      VALUES (${id}, ${name}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET executed_at = CURRENT_TIMESTAMP
    `);
  }

  async removeMigration(db: DatabaseClient, id: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM ${sql.identifier(this.tableName)}
      WHERE id = ${id}
    `);
  }
}

function getResultRows(result: unknown): Record<string, unknown>[] {
  if (result === null || result === undefined) {
    return [];
  }

  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }

  if (typeof result === "object" && result !== null && "rows" in result) {
    const rows = (result as { readonly rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }

  throw new UnsupportedMigrationQueryResultProblem();
}

function getExecutedAt(row: Record<string, unknown>): Date {
  const value = row.executedAt ?? row.executed_at ?? row.executedat;

  return value ? new Date(String(value)) : new Date();
}
