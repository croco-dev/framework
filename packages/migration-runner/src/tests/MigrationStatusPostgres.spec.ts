import { join } from "node:path";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../cli";
import type { DatabaseClient } from "../libs/db-types";
import { MigrationRunner } from "../libs/MigrationRunner";
import { createMigrationFixtures } from "./helpers/createMigrationFixtures";

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

describe.skipIf(connectionString.length === 0)("migration preview PostgreSQL integration", () => {
  const pool = new Pool({ connectionString });
  const previewTable = "_croco_preview_read_only_3868";

  beforeEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${previewTable}"`);
    await pool.query(`CREATE TABLE "${previewTable}" (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`INSERT INTO "${previewTable}" (id, name, executed_at) VALUES
      ('20261001000000', 'create_accounts', '2026-10-01 00:00:00'),
      ('20261002000000', 'create_orders', '2026-10-02 00:00:00')`);
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${previewTable}"`);
    await pool.end();
  });

  it.each(["previewUp", "previewDown"] as const)(
    "%s succeeds with an existing checkpoint table in a PostgreSQL READ ONLY transaction",
    async (operation) => {
      const fixtures = createMigrationFixtures([
        { id: "20261001000000", name: "create_accounts" },
        { id: "20261002000000", name: "create_orders" },
        { id: "20261003000000", name: "create_invoices" },
      ]);
      try {
        const before = await pool.query(`SELECT * FROM "${previewTable}" ORDER BY id`);
        await drizzle(pool).transaction(
          async (tx) => {
            const mode = await tx.execute(sql`SHOW transaction_read_only`);
            expect(mode.rows).toEqual([{ transaction_read_only: "on" }]);
            const runner = new MigrationRunner(
              tx as unknown as DatabaseClient,
              fixtures.path,
              previewTable,
            );

            await expect(runner[operation]()).resolves.toEqual(
              operation === "previewUp"
                ? ["20261003000000_create_invoices"]
                : ["20261002000000_create_orders"],
            );
          },
          { accessMode: "read only" },
        );
        const after = await pool.query(`SELECT * FROM "${previewTable}" ORDER BY id`);
        expect(after.rows).toEqual(before.rows);
      } finally {
        fixtures.cleanup();
      }
    },
  );
});
