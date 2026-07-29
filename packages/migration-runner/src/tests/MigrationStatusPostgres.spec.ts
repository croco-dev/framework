import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../cli";

const connectionString = process.env.MIGRATION_POSTGRES_URL ?? "";
const tableName = "_croco_status_fresh_1580";

describe.skipIf(connectionString.length === 0)("migration status PostgreSQL integration", () => {
  const pool = new Pool({ connectionString });

  beforeEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await pool.end();
  });

  it("reports pending migrations through the CLI without creating the metadata table", async () => {
    const output: string[] = [];
    const errors: string[] = [];
    const exitCodes: Parameters<typeof process.exit>[0][] = [];
    const outputSpy = vi.spyOn(console, "log").mockImplementation((message) => {
      output.push(String(message));
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((message) => {
      errors.push(String(message));
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCodes.push(code);
      return undefined as never;
    });

    try {
      await createProgram().parseAsync(
        [
          "status",
          "--dir",
          join(__dirname, "fixtures", "migrations"),
          "--connection",
          connectionString,
          "--table",
          tableName,
        ],
        { from: "user" },
      );

      const tableResult = await pool.query<{ exists: string | null }>(
        "SELECT to_regclass(quote_ident($1)) AS exists",
        [tableName],
      );

      expect(errors).toEqual([]);
      expect(exitCodes).toEqual([0]);
      expect(output).toEqual([
        "Migration status:",
        "  ○ 20240101000001_create_users",
        "  ○ 20240101000002_create_posts",
        "\n0/2 migrations executed",
      ]);
      expect(tableResult.rows).toEqual([{ exists: null }]);
    } finally {
      outputSpy.mockRestore();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
