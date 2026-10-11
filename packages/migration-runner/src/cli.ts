#!/usr/bin/env node
import { Problem } from "@croco/problems-core";
import { Command } from "commander";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseClient } from "./libs/db-types";
import { MigrationRunner } from "./libs/MigrationRunner";
import { MigrationScanner } from "./libs/MigrationScanner";
import { DatabaseUrlRequiredProblem } from "./libs/problems/DatabaseUrlRequiredProblem";
import { MigrationFileLoadProblem } from "./libs/problems/MigrationFileLoadProblem";
import { MissingDownFunctionProblem } from "./libs/problems/MissingDownFunctionProblem";
import { MissingUpFunctionProblem } from "./libs/problems/MissingUpFunctionProblem";
import { UnsupportedDialectProblem } from "./libs/problems/UnsupportedDialectProblem";
import { assertUniqueMigrationFileIds } from "./libs/reconcileMigrationHistory";
import { parseMigrationCount } from "./libs/validateMigrationCount";
import { assertValidMigrationTarget } from "./libs/validateMigrationTarget";
import { getPackageVersion } from "./package-version";

export type MigrationCliPool = {
  end: () => Promise<void>;
};

export type MigrationCliRuntime = {
  createDbClient: (
    connectionUrl: string | undefined,
    dialect: string,
  ) => Promise<{ db: DatabaseClient; pool: MigrationCliPool }>;
  writeOutput: (message: string) => void;
  writeError: (message: string) => void;
  exit: (code: number) => void;
};

export type UpOptions = {
  dir: string;
  target?: string;
  connection?: string;
  table: string;
  dialect: string;
  dryRun?: boolean;
};

export type DownOptions = {
  dir: string;
  target?: string;
  count: string;
  connection?: string;
  table: string;
  dialect: string;
  dryRun?: boolean;
};

export type StatusOptions = {
  dir: string;
  connection?: string;
  table: string;
  dialect: string;
};

type ValidateOptions = {
  dir: string;
};

export async function runUp(
  options: UpOptions,
  runtime: MigrationCliRuntime = DEFAULT_RUNTIME,
): Promise<void> {
  let pool: MigrationCliPool | undefined;
  let exitCode = 0;
  try {
    const { db, pool: dbPool } = await runtime.createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db, options.dir, options.table);

    if (options.dryRun) {
      const planned = await runner.previewUp(options.target);
      writeMigrationList(
        runtime,
        planned,
        "Would execute",
        "No pending migrations to execute",
        "○",
      );
      return;
    }

    const executed = await runner.up(options.target);
    writeMigrationList(runtime, executed, "Executed", "No pending migrations", "✓");
  } catch (error) {
    runtime.writeError(formatCliFailure("Migration failed", error));
    if (!options.dryRun && pool) {
      runtime.writeError(
        "Recovery: Forward migration state is uncertain. Inspect `migrate status` and the database state, correct the reported failure, then rerun `migrate up`.",
      );
    }
    exitCode = 1;
  } finally {
    await finalizeCommand(runtime, pool, exitCode);
  }
}

export async function runDown(
  options: DownOptions,
  runtime: MigrationCliRuntime = DEFAULT_RUNTIME,
): Promise<void> {
  let pool: MigrationCliPool | undefined;
  let exitCode = 0;
  try {
    if (options.target !== undefined) {
      assertValidMigrationTarget(options.target);
    }
    const count = options.target === undefined ? parseMigrationCount(options.count) : undefined;
    const { db, pool: dbPool } = await runtime.createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db, options.dir, options.table);

    if (options.dryRun) {
      const planned = await runner.previewDown(options.target, count);
      writeMigrationList(runtime, planned, "Would revert", "No migrations to revert", "○");
      return;
    }

    const reverted = await runner.down(options.target, count);
    writeMigrationList(runtime, reverted, "Reverted", "No migrations to revert", "↓");
  } catch (error) {
    runtime.writeError(formatCliFailure("Migration failed", error));
    if (!options.dryRun && pool) {
      runtime.writeError(
        "Recovery: Rollback state is uncertain. Inspect `migrate status` and the database state, correct the reported failure, then rerun `migrate down`.",
      );
    }
    exitCode = 1;
  } finally {
    await finalizeCommand(runtime, pool, exitCode);
  }
}

export async function runStatus(
  options: StatusOptions,
  runtime: MigrationCliRuntime = DEFAULT_RUNTIME,
): Promise<void> {
  let pool: MigrationCliPool | undefined;
  let exitCode = 0;
  try {
    const { db, pool: dbPool } = await runtime.createDbClient(options.connection, options.dialect);
    pool = dbPool;
    const runner = new MigrationRunner(db, options.dir, options.table);

    const status = await runner.status();

    if (status.length === 0) {
      runtime.writeOutput("No migrations found");
    } else {
      runtime.writeOutput("Migration status:");
      for (const s of status) {
        const symbol = s.executed ? "✓" : "○";
        const date = s.executedAt ? ` (${s.executedAt.toISOString()})` : "";
        runtime.writeOutput(`  ${symbol} ${s.id}_${s.name}${date}`);
      }
      const executed = status.filter((s) => s.executed).length;
      runtime.writeOutput(`\n${executed}/${status.length} migrations executed`);
    }
  } catch (error) {
    runtime.writeError(formatCliFailure("Status check failed", error));
    exitCode = 1;
  } finally {
    await finalizeCommand(runtime, pool, exitCode);
  }
}

async function runValidate(options: ValidateOptions, runtime: MigrationCliRuntime): Promise<void> {
  let exitCode = 0;
  try {
    const files = await new MigrationScanner(options.dir).scan();
    assertUniqueMigrationFileIds(files);

    for (const file of files) {
      if (typeof file.up !== "function") {
        throw new MissingUpFunctionProblem(file.id, file.name);
      }
      if (typeof file.down !== "function") {
        throw new MissingDownFunctionProblem(file.id, file.name);
      }
    }

    writeMigrationList(
      runtime,
      files.map(({ id, name }) => `${id}_${name}`),
      "Validated",
      "No migrations found",
      "✓",
    );
  } catch (error) {
    runtime.writeError(formatCliFailure("Validation failed", error));
    exitCode = 1;
  } finally {
    await finalizeCommand(runtime, undefined, exitCode);
  }
}

export function createProgram(runtime: MigrationCliRuntime = DEFAULT_RUNTIME): Command {
  const program = new Command();
  program.name("migrate").description("Drizzle migration runner").version(getPackageVersion());

  program
    .command("up")
    .description("Run pending migrations")
    .option("-d, --dir <path>", "migrations directory", "./migrations")
    .option("-t, --target <id>", "target migration ID")
    .option("-c, --connection <url>", "database connection URL")
    .option("--table <name>", "migrations table name", "_migrations")
    .option("--dialect <dialect>", "database dialect (postgres)", "postgres")
    .option("--dry-run", "show migrations without applying them", false)
    .action(async (options: UpOptions) => {
      await runUp(options, runtime);
    });

  program
    .command("down")
    .description("Revert migrations")
    .option("-d, --dir <path>", "migrations directory", "./migrations")
    .option("-t, --target <id>", "target migration ID to revert to")
    .option("-n, --count <number>", "number of migrations to revert", "1")
    .option("-c, --connection <url>", "database connection URL")
    .option("--table <name>", "migrations table name", "_migrations")
    .option("--dialect <dialect>", "database dialect (postgres)", "postgres")
    .option("--dry-run", "show migrations without reverting them", false)
    .action(async (options: DownOptions) => {
      await runDown(options, runtime);
    });

  program
    .command("status")
    .description("Show migration status")
    .option("-d, --dir <path>", "migrations directory", "./migrations")
    .option("-c, --connection <url>", "database connection URL")
    .option("--table <name>", "migrations table name", "_migrations")
    .option("--dialect <dialect>", "database dialect (postgres)", "postgres")
    .action(async (options: StatusOptions) => {
      await runStatus(options, runtime);
    });

  program
    .command("validate")
    .description("Load and validate migration files without a database connection")
    .option("-d, --dir <path>", "migrations directory", "./migrations")
    .action(async (options: ValidateOptions) => {
      await runValidate(options, runtime);
    });

  return program;
}

async function createDbClient(
  connectionUrl: string | undefined,
  dialect: string,
): Promise<{ db: DatabaseClient; pool: Pool }> {
  const url = connectionUrl || process.env.DATABASE_URL;

  if (!url) {
    throw new DatabaseUrlRequiredProblem();
  }

  switch (dialect) {
    case "postgres": {
      const pool = new Pool({ connectionString: url });
      const db = drizzle(pool) as unknown as DatabaseClient;
      return { db, pool };
    }
    default:
      throw new UnsupportedDialectProblem(dialect);
  }
}

function writeMigrationList(
  runtime: MigrationCliRuntime,
  migrations: readonly string[],
  heading: string,
  emptyMessage: string,
  symbol: string,
): void {
  if (migrations.length === 0) {
    runtime.writeOutput(emptyMessage);
    return;
  }

  runtime.writeOutput(`${heading} ${migrations.length} migration(s):`);
  for (const id of migrations) {
    runtime.writeOutput(`  ${symbol} ${id}`);
  }
}

function formatCliFailure(prefix: string, error: unknown): string {
  return `${prefix}: ${formatCliError(error)}`;
}

function formatCliError(error: unknown): string {
  if (error instanceof Problem) {
    const details = error.toJSON();
    const detail = typeof details.detail === "string" ? `: ${details.detail}` : "";
    const message = `${details.code} (${details.status} ${details.title})${detail}`;

    if (error instanceof MigrationFileLoadProblem && error.cause instanceof Error) {
      return `${message}: ${error.cause.message}\nRecovery: Check the migration and its imports. For .ts files, match the package module type and use erasable TypeScript syntax. Replace enums, parameter properties, runtime namespaces, and decorators with JavaScript, or compile to .js before deployment.`;
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function finalizeCommand(
  runtime: MigrationCliRuntime,
  pool: MigrationCliPool | undefined,
  exitCode: number,
): Promise<void> {
  let finalExitCode = exitCode;
  let cleanupFailure: string | undefined;

  try {
    await pool?.end();
  } catch (error) {
    finalExitCode = 1;
    cleanupFailure = formatCliFailure("Cleanup failed", error);
  }

  try {
    if (cleanupFailure) {
      runtime.writeError(cleanupFailure);
    }
  } finally {
    runtime.exit(finalExitCode);
  }
}

const DEFAULT_RUNTIME: MigrationCliRuntime = {
  createDbClient,
  writeOutput: (message) => console.log(message),
  writeError: (message) => console.error(message),
  exit: (code) => process.exit(code),
};

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  void createProgram().parseAsync();
}
