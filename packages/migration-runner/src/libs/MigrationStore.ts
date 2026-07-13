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

  async hasTable(db: DatabaseClient): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT to_regclass(quote_ident(${this.tableName})) IS NOT NULL AS "exists"
    `);
    const rows = getResultRows(result);
    const row = rows[0];
    if (rows.length !== 1 || !isRecord(row)) {
      throw new UnsupportedMigrationQueryResultProblem();
    }

    const exists = getOwnDataPropertyValue(row, "exists");
    if (typeof exists !== "boolean") {
      throw new UnsupportedMigrationQueryResultProblem();
    }

    return exists;
  }

  async getExecutedMigrations(db: DatabaseClient): Promise<MigrationRecord[]> {
    const result = await db.execute(sql`
      SELECT id, name, executed_at as executedAt
      FROM ${sql.identifier(this.tableName)}
      ORDER BY executed_at ASC
    `);

    const rows = getResultRows(result);

    return rows.map(decodeMigrationRecord);
  }

  async recordMigration(db: DatabaseClient, id: string, name: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO ${sql.identifier(this.tableName)} (id, name, executed_at)
      VALUES (${id}, ${name}, CURRENT_TIMESTAMP)
    `);
  }

  async reserveMigration(db: DatabaseClient, id: string, name: string): Promise<boolean> {
    const result = await db.execute(sql`
      INSERT INTO ${sql.identifier(this.tableName)} (id, name, executed_at)
      VALUES (${id}, ${name}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

    return getResultRows(result).length > 0;
  }

  async completeMigration(db: DatabaseClient, id: string): Promise<void> {
    await db.execute(sql`
      UPDATE ${sql.identifier(this.tableName)}
      SET executed_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
  }

  async claimMigrationForRollback(db: DatabaseClient, id: string): Promise<boolean> {
    const result = await db.execute(sql`
      DELETE FROM ${sql.identifier(this.tableName)}
      WHERE id = ${id}
      RETURNING id
    `);

    return getResultRows(result).length > 0;
  }

  async removeMigration(db: DatabaseClient, id: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM ${sql.identifier(this.tableName)}
      WHERE id = ${id}
    `);
  }
}

function getResultRows(result: unknown): unknown[] {
  if (result === null || result === undefined) {
    throw new UnsupportedMigrationQueryResultProblem();
  }

  if (Array.isArray(result)) {
    return result;
  }

  if (typeof result === "object" && result !== null && "rows" in result) {
    const rows = (result as { readonly rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows;
    }
  }

  throw new UnsupportedMigrationQueryResultProblem();
}

function decodeMigrationRecord(row: unknown, rowIndex: number): MigrationRecord {
  if (!isRecord(row)) {
    throw new UnsupportedMigrationQueryResultProblem({
      rowIndex,
      field: "row",
    });
  }

  return {
    id: decodeRequiredString(getOwnDataPropertyValue(row, "id"), rowIndex, "id"),
    name: decodeRequiredString(getOwnDataPropertyValue(row, "name"), rowIndex, "name"),
    executedAt: decodeExecutedAt(getExecutedAtValue(row), rowIndex),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeRequiredString(value: unknown, rowIndex: number, field: "id" | "name"): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnsupportedMigrationQueryResultProblem({ rowIndex, field });
  }

  return value;
}

function getExecutedAtValue(row: Record<string, unknown>): unknown {
  for (const alias of ["executedAt", "executed_at", "executedat"] as const) {
    if (Object.getOwnPropertyDescriptor(row, alias)) {
      return getOwnDataPropertyValue(row, alias);
    }
  }

  return undefined;
}

function getOwnDataPropertyValue(row: Record<string, unknown>, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(row, field);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function decodeExecutedAt(value: unknown, rowIndex: number): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === "string") {
    const isoTimestamp = parseExplicitZoneIsoTimestamp(value);
    if (isoTimestamp) {
      return isoTimestamp;
    }

    const databaseTimestamp = parseDatabaseTimestamp(value);
    if (databaseTimestamp) {
      return databaseTimestamp;
    }
  }

  throw new UnsupportedMigrationQueryResultProblem({
    rowIndex,
    field: "executedAt",
  });
}

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;
const DATABASE_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

function parseExplicitZoneIsoTimestamp(value: string): Date | undefined {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || !hasValidDateTimeParts(match)) {
    return undefined;
  }

  const offset = match[8];
  if (!offset || (offset !== "Z" && !hasValidOffset(offset))) {
    return undefined;
  }

  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? new Date(epoch) : undefined;
}

function parseDatabaseTimestamp(value: string): Date | undefined {
  const match = DATABASE_TIMESTAMP_PATTERN.exec(value);
  if (!match || !hasValidDateTimeParts(match)) {
    return undefined;
  }

  const epoch = Date.parse(`${value.replace(" ", "T")}Z`);
  return Number.isFinite(epoch) ? new Date(epoch) : undefined;
}

function hasValidDateTimeParts(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const lastDayOfMonth = getDaysInMonth(year, month);
  return day <= lastDayOfMonth;
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function hasValidOffset(offset: string): boolean {
  const hour = Number(offset.slice(1, 3));
  const minute = Number(offset.slice(4, 6));

  return minute <= 59 && (hour < 14 || (hour === 14 && minute === 0));
}
