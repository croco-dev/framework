import { sql } from 'drizzle-orm';
import type { MigrationRecord } from './types';

export type DatabaseClient = {
  execute: (query: unknown) => Promise<unknown>;
};

export class MigrationStore {
  private readonly tableName: string;

  constructor(tableName = '_migrations') {
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

    if (!result) return [];

    return (result as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      executedAt: row.executedAt ? new Date(String(row.executedAt)) : new Date(),
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
