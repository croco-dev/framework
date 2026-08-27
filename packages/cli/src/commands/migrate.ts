import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { ArgsDef } from "citty";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { resolveCliBinFromEntry } from "./resolveCliBin.js";

const require = createRequire(import.meta.url);

export type MigrateCommand = "up" | "down" | "status";
export type MigrationRunnerSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;
export type MigrateCommandResult =
  | {
      readonly exitCode: 0;
      readonly status: "completed";
    }
  | {
      readonly exitCode: number;
      readonly message?: string;
      readonly reason: "invalid-arguments" | "launch-failed" | "runner-exit";
      readonly status: "failed";
    };
export type RunMigrateCommandOptions = {
  readonly resolveBin?: () => string;
  readonly spawn?: MigrationRunnerSpawn;
};
export type CreateMigrateCommandOptions = {
  readonly onResult?: (result: MigrateCommandResult) => Promise<void> | void;
};

type MigrationOptionName = keyof typeof MIGRATION_OPTION_SPECS;
type MigrationOptionValue = boolean | string;

type MigrationOptionSpec = {
  readonly alias?: string;
  readonly childFlag?: string;
  readonly commands: readonly MigrateCommand[];
  readonly description: string;
  readonly longAliases?: readonly string[];
  readonly type: "boolean" | "string";
  readonly valueHint?: string;
};

type MigrationRunnerInvocation = {
  readonly args: string[];
  readonly cwd?: string;
  readonly ok: true;
};

type MigrationArgumentFailure = {
  readonly message: string;
  readonly ok: false;
};

const ALL_MIGRATE_COMMANDS = ["up", "down", "status"] as const;

const MIGRATION_OPTION_SPECS = {
  cwd: {
    commands: ALL_MIGRATE_COMMANDS,
    description: "Working directory for migration inputs and configuration",
    type: "string",
    valueHint: "path",
  },
  dir: {
    alias: "d",
    childFlag: "--dir",
    commands: ALL_MIGRATE_COMMANDS,
    description: "Migrations directory",
    type: "string",
    valueHint: "path",
  },
  target: {
    alias: "t",
    childFlag: "--target",
    commands: ["up", "down"],
    description: "Target migration ID",
    type: "string",
    valueHint: "id",
  },
  count: {
    alias: "n",
    childFlag: "--count",
    commands: ["down"],
    description: "Number of migrations to revert",
    type: "string",
    valueHint: "number",
  },
  connection: {
    alias: "c",
    childFlag: "--connection",
    commands: ALL_MIGRATE_COMMANDS,
    description: "Database connection URL",
    type: "string",
    valueHint: "url",
  },
  table: {
    childFlag: "--table",
    commands: ALL_MIGRATE_COMMANDS,
    description: "Migrations table name",
    type: "string",
    valueHint: "name",
  },
  dialect: {
    childFlag: "--dialect",
    commands: ALL_MIGRATE_COMMANDS,
    description: "Database dialect (postgres)",
    type: "string",
    valueHint: "dialect",
  },
  dryRun: {
    childFlag: "--dry-run",
    commands: ["up", "down"],
    description: "Preview migrations without applying them",
    longAliases: ["dry-run"],
    type: "boolean",
  },
} as const satisfies Record<string, MigrationOptionSpec>;

export function createMigrateCommand(options: CreateMigrateCommandOptions = {}) {
  const createSubcommand = (command: MigrateCommand, description: string) =>
    defineCommand({
      meta: {
        name: command,
        description,
      },
      args: migrationArgsFor(command),
      async run({ rawArgs }) {
        const result = await runMigrateCommand(command, rawArgs);
        await options.onResult?.(result);
        return result;
      },
    });

  return defineCommand({
    meta: {
      name: "migrate",
      description: "Manage database migrations",
    },
    subCommands: {
      up: createSubcommand("up", "Run pending migrations"),
      down: createSubcommand("down", "Rollback migrations"),
      status: createSubcommand("status", "Show migration status"),
    },
  });
}

export const migrate = createMigrateCommand();

export async function runMigrateCommand(
  command: MigrateCommand,
  rawArgs: readonly string[],
  options: RunMigrateCommandOptions = {},
): Promise<MigrateCommandResult> {
  const resolveBin = options.resolveBin ?? resolveMigrationRunnerBin;
  const spawnChild = options.spawn ?? spawn;
  const invocation = buildMigrationRunnerInvocation(command, rawArgs);

  if (!invocation.ok) {
    return {
      exitCode: 1,
      message: invocation.message,
      reason: "invalid-arguments",
      status: "failed",
    };
  }

  let child: ChildProcess;
  try {
    child = spawnChild(process.execPath, [resolveBin(), command, ...invocation.args], {
      ...(invocation.cwd === undefined ? {} : { cwd: invocation.cwd }),
      stdio: "inherit",
    });
  } catch (error) {
    return {
      exitCode: 1,
      message: error instanceof Error ? error.message : String(error),
      reason: "launch-failed",
      status: "failed",
    };
  }

  return new Promise((resolve) => {
    const settle = (result: MigrateCommandResult): void => {
      child.off("exit", onExit);
      child.off("error", onError);
      resolve(result);
    };
    const onExit = (code: number | null): void => {
      settle(
        code === 0
          ? { exitCode: 0, status: "completed" }
          : { exitCode: code ?? 1, reason: "runner-exit", status: "failed" },
      );
    };
    const onError = (error: Error): void => {
      settle({
        exitCode: 1,
        message: error.message,
        reason: "launch-failed",
        status: "failed",
      });
    };

    child.once("exit", onExit);
    child.once("error", onError);
  });
}

export function resolveMigrationRunnerBin(): string {
  return resolveMigrationRunnerBinFromEntry(require.resolve("@croco/migration-runner"));
}

export function resolveMigrationRunnerBinFromEntry(entry: string): string {
  return resolveCliBinFromEntry(entry);
}

export function isMigrateCommand(argument: string): argument is MigrateCommand {
  return ALL_MIGRATE_COMMANDS.some((command) => command === argument);
}

export function migrateOptionConsumesNextArgument(argument: string): boolean {
  if (argument.startsWith("--")) {
    const separator = argument.indexOf("=");
    const optionName = argument.slice(2, separator === -1 ? undefined : separator);
    const spec = allMigrationOptionEntries().find(
      ([name, candidate]) => name === optionName || candidate.longAliases?.includes(optionName),
    )?.[1];
    return spec?.type === "string" && separator === -1;
  }

  if (argument.startsWith("-") && argument !== "-") {
    const spec = allMigrationOptionEntries().find(
      ([, candidate]) => candidate.alias === argument.slice(1, 2),
    )?.[1];
    return spec?.type === "string" && argument.length === 2;
  }

  return false;
}

export function migrateArgumentsAreValid(
  command: MigrateCommand,
  rawArgs: readonly string[],
): boolean {
  return parseMigrationOptions(command, rawArgs).ok;
}

function migrationArgsFor(command: MigrateCommand): ArgsDef {
  return Object.fromEntries(
    migrationOptionEntries(command).map(([name, spec]) => [
      name,
      {
        ...(spec.alias === undefined ? {} : { alias: spec.alias }),
        description: spec.description,
        type: spec.type,
        ...(spec.valueHint === undefined ? {} : { valueHint: spec.valueHint }),
      },
    ]),
  );
}

function buildMigrationRunnerInvocation(
  command: MigrateCommand,
  rawArgs: readonly string[],
): MigrationRunnerInvocation | MigrationArgumentFailure {
  const parsed = parseMigrationOptions(command, rawArgs);
  if (!parsed.ok) {
    return parsed;
  }

  const args: string[] = [];
  for (const [name, spec] of migrationOptionEntries(command)) {
    const value = parsed.values[name];
    if (value === undefined || spec.childFlag === undefined) {
      continue;
    }

    args.push(spec.childFlag);
    if (typeof value === "string") {
      args.push(value);
    }
  }

  const cwd = parsed.values.cwd;
  return {
    args,
    ...(typeof cwd === "string" ? { cwd } : {}),
    ok: true,
  };
}

function parseMigrationOptions(
  command: MigrateCommand,
  rawArgs: readonly string[],
):
  | {
      readonly ok: true;
      readonly values: Partial<Record<MigrationOptionName, MigrationOptionValue>>;
    }
  | MigrationArgumentFailure {
  const longOptions = new Map<string, [MigrationOptionName, MigrationOptionSpec]>();
  const shortOptions = new Map<string, [MigrationOptionName, MigrationOptionSpec]>();
  for (const [name, spec] of migrationOptionEntries(command)) {
    longOptions.set(name, [name, spec]);
    for (const alias of spec.longAliases ?? []) {
      longOptions.set(alias, [name, spec]);
    }
    if (spec.alias !== undefined) {
      shortOptions.set(spec.alias, [name, spec]);
    }
  }

  const values: Partial<Record<MigrationOptionName, MigrationOptionValue>> = {};
  for (let index = 0; index < rawArgs.length; index++) {
    const token = rawArgs[index];
    if (token === undefined) {
      continue;
    }

    if (token.startsWith("--")) {
      const separator = token.indexOf("=");
      const optionName = token.slice(2, separator === -1 ? undefined : separator);
      const option = longOptions.get(optionName);
      if (!option) {
        return { message: `Unknown option: ${token}`, ok: false };
      }

      const [name, spec] = option;
      if (spec.type === "boolean") {
        if (separator !== -1) {
          return { message: `Unknown option: ${token}`, ok: false };
        }
        values[name] = true;
        continue;
      }

      const inlineValue = separator === -1 ? undefined : token.slice(separator + 1);
      const value = inlineValue ?? rawArgs[index + 1];
      if (value === undefined) {
        return { message: `Option --${optionName} requires a value`, ok: false };
      }
      values[name] = value;
      if (inlineValue === undefined) {
        index++;
      }
      continue;
    }

    if (token.startsWith("-") && token !== "-") {
      const option = shortOptions.get(token.slice(1, 2));
      if (!option) {
        return { message: `Unknown option: ${token}`, ok: false };
      }

      const [name, spec] = option;
      if (spec.type === "boolean") {
        if (token.length > 2) {
          return { message: `Unknown option: ${token}`, ok: false };
        }
        values[name] = true;
        continue;
      }

      const inlineValue = token.length > 2 ? token.slice(2) : undefined;
      const value = inlineValue ?? rawArgs[index + 1];
      if (value === undefined) {
        return { message: `Option ${token} requires a value`, ok: false };
      }
      values[name] = value;
      if (inlineValue === undefined) {
        index++;
      }
      continue;
    }

    return { message: `Unexpected argument: ${token}`, ok: false };
  }

  return { ok: true, values };
}

function migrationOptionEntries(
  command: MigrateCommand,
): [MigrationOptionName, MigrationOptionSpec][] {
  return allMigrationOptionEntries().filter(([, spec]) => spec.commands.includes(command));
}

function allMigrationOptionEntries(): [MigrationOptionName, MigrationOptionSpec][] {
  return Object.entries(MIGRATION_OPTION_SPECS) as [MigrationOptionName, MigrationOptionSpec][];
}
