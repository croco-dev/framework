import { defineCommand } from "citty";
import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { GLOBAL_OPTIONS } from "./options.js";

const require = createRequire(import.meta.url);

export type MigrateCommand = "up" | "down" | "status";
export type MigrationRunnerSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

const migrateUp = defineCommand({
  meta: {
    name: "up",
    description: "Run pending migrations",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run({ rawArgs }) {
    runMigrateCommand("up", rawArgs);
  },
});

const migrateDown = defineCommand({
  meta: {
    name: "down",
    description: "Rollback migrations",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run({ rawArgs }) {
    runMigrateCommand("down", rawArgs);
  },
});

const migrateStatus = defineCommand({
  meta: {
    name: "status",
    description: "Show migration status",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run({ rawArgs }) {
    runMigrateCommand("status", rawArgs);
  },
});

export const migrate = defineCommand({
  meta: {
    name: "migrate",
    description: "Manage database migrations",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    up: migrateUp,
    down: migrateDown,
    status: migrateStatus,
  },
});

export function runMigrateCommand(
  command: MigrateCommand,
  args: string[],
  options: {
    readonly resolveBin?: () => string;
    readonly spawn?: MigrationRunnerSpawn;
    readonly setExitCode?: (code: number) => void;
    readonly writeError?: (message: string) => void;
  } = {},
): void {
  const resolveBin = options.resolveBin ?? resolveMigrationRunnerBin;
  const spawnChild = options.spawn ?? spawn;
  const setExitCode =
    options.setExitCode ??
    ((code: number) => {
      process.exit(code);
    });
  const writeError = options.writeError ?? ((message: string) => console.error(message));
  const child = spawnChild(process.execPath, [resolveBin(), command, ...args], {
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    setExitCode(code ?? 1);
  });

  child.on("error", (error) => {
    writeError(error.message);
    setExitCode(1);
  });
}

export function resolveMigrationRunnerBin(): string {
  return require.resolve("@croco/migration-runner/dist/cli.js");
}
