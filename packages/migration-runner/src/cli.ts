#!/usr/bin/env node
import { Command } from "commander";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseClient } from "./libs/db-types";
import { MigrationRunner } from "./libs/MigrationRunner";
import { DatabaseUrlRequiredProblem } from "./libs/problems/DatabaseUrlRequiredProblem";
import { UnsupportedDialectProblem } from "./libs/problems/UnsupportedDialectProblem";
import { getPackageVersion } from "./package-version";

const program = new Command();

program.name("migrate").description("Drizzle migration runner").version(getPackageVersion());

export type UpOptions = {
  dir: string;
  target?: string;
  connection?: string;
  table: string;
  dialect: string;
};

export type DownOptions = {
  dir: string;
  target?: string;
  count: string;
  connection?: string;
  table: string;
  dialect: string;
};

export type StatusOptions = {
  dir: string;
  connection?: string;
  table: string;
  dialect: string;
};

export async function runUp(options: UpOptions): Promise<void> {
  let pool: Pool | undefined;
  let exitCode = 0;
  try {
    const { db, pool: dbPool } = await createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db as unknown as DatabaseClient, options.dir, options.table);

    const executed = await runner.up(options.target);

    if (executed.length === 0) {
      console.log("No pending migrations");
    } else {
      console.log(`Executed ${executed.length} migration(s):`);
      for (const id of executed) {
        console.log(`  ✓ ${id}`);
      }
    }
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    await pool?.end();
    process.exit(exitCode);
  }
}

export async function runDown(options: DownOptions): Promise<void> {
  let pool: Pool | undefined;
  let exitCode = 0;
  try {
    const { db, pool: dbPool } = await createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db as unknown as DatabaseClient, options.dir, options.table);

    const count = options.target ? undefined : parseInt(options.count, 10);
    const reverted = await runner.down(options.target, count);

    if (reverted.length === 0) {
      console.log("No migrations to revert");
    } else {
      console.log(`Reverted ${reverted.length} migration(s):`);
      for (const id of reverted) {
        console.log(`  ↓ ${id}`);
      }
    }
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    await pool?.end();
    process.exit(exitCode);
  }
}

export async function runStatus(options: StatusOptions): Promise<void> {
  let pool: Pool | undefined;
  let exitCode = 0;
  try {
    const { db, pool: dbPool } = await createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db as unknown as DatabaseClient, options.dir, options.table);

    const status = await runner.status();

    if (status.length === 0) {
      console.log("No migrations found");
    } else {
      console.log("Migration status:");
      for (const s of status) {
        const symbol = s.executed ? "✓" : "○";
        const date = s.executedAt ? ` (${s.executedAt.toISOString()})` : "";
        console.log(`  ${symbol} ${s.id}_${s.name}${date}`);
      }
      const executed = status.filter((s) => s.executed).length;
      console.log(`\n${executed}/${status.length} migrations executed`);
    }
  } catch (error) {
    console.error("Status check failed:", error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    await pool?.end();
    process.exit(exitCode);
  }
}

program
  .command("up")
  .description("Run pending migrations")
  .option("-d, --dir <path>", "migrations directory", "./migrations")
  .option("-t, --target <id>", "target migration ID")
  .option("-c, --connection <url>", "database connection URL")
  .option("--table <name>", "migrations table name", "_migrations")
  .option("--dialect <dialect>", "database dialect (postgres, sqlite, mysql)", "postgres")
  .action(async (options) => {
    await runUp(options);
  });

program
  .command("down")
  .description("Revert migrations")
  .option("-d, --dir <path>", "migrations directory", "./migrations")
  .option("-t, --target <id>", "target migration ID to revert to")
  .option("-n, --count <number>", "number of migrations to revert", "1")
  .option("-c, --connection <url>", "database connection URL")
  .option("--table <name>", "migrations table name", "_migrations")
  .option("--dialect <dialect>", "database dialect (postgres, sqlite, mysql)", "postgres")
  .action(async (options) => {
    await runDown(options);
  });

program
  .command("status")
  .description("Show migration status")
  .option("-d, --dir <path>", "migrations directory", "./migrations")
  .option("-c, --connection <url>", "database connection URL")
  .option("--table <name>", "migrations table name", "_migrations")
  .option("--dialect <dialect>", "database dialect (postgres, sqlite, mysql)", "postgres")
  .action(async (options) => {
    await runStatus(options);
  });

async function createDbClient(
  connectionUrl: string | undefined,
  dialect: string,
): Promise<{ db: ReturnType<typeof drizzle>; pool: Pool }> {
  const url = connectionUrl || process.env.DATABASE_URL;

  if (!url) {
    throw new DatabaseUrlRequiredProblem();
  }

  switch (dialect) {
    case "postgres": {
      const pool = new Pool({ connectionString: url });
      const db = drizzle(pool);
      return { db, pool };
    }
    default:
      throw new UnsupportedDialectProblem(dialect);
  }
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  program.parse();
}
