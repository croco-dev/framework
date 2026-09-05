import { defineCommand, renderUsage, runCommand } from "citty";
import type { ArgsDef, CommandContext, CommandDef, Resolvable, SubCommandsDef } from "citty";
import {
  createCrocoCommandRuntime,
  isCrocoCommandExit,
  runWithCrocoCommandRuntime,
} from "../libs/cliRuntime.js";
import type { CrocoCommandDependencies, CrocoCommandRuntime } from "../libs/cliRuntime.js";
import { getDelegatedCommandRuntimeOptions } from "../libs/delegatedCommand.js";
import { doctor } from "./doctor.js";
import {
  createMigrateCommand,
  isMigrateCommand,
  migrateArgumentsAreValid,
  migrateOptionConsumesNextArgument,
} from "./migrate.js";
import { GLOBAL_OPTIONS } from "./options.js";

type LoadedCommand = Awaited<Extract<SubCommandsDef[string], Promise<unknown>>>;
type CommandLoader = () => Promise<LoadedCommand>;

export type CrocoRunResult = {
  readonly exitCode: number;
};

export function createCrocoCommand(
  dependencies: CrocoCommandDependencies = {},
): CommandDef<typeof GLOBAL_OPTIONS> {
  return createBoundCrocoCommand(createCrocoCommandRuntime(dependencies));
}

export async function runCroco(
  argv: readonly string[],
  dependencies: CrocoCommandDependencies = {},
): Promise<CrocoRunResult> {
  const runtime = createCrocoCommandRuntime(dependencies);
  const command = createBoundCrocoCommand(runtime);
  const rawArgs = normalizeMigrateRootArgs(normalizeDesktopRootArgs(argv));

  try {
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      runtime.stdout(`${await renderHelpUsage(command, rawArgs)}\n`);
      return toRunResult(runtime.getExitCode());
    }

    if (rawArgs.length === 1 && rawArgs[0] === "--version") {
      const meta = await resolveValue(command.meta);
      if (!meta?.version) {
        throw createCliError("No version specified", "E_NO_VERSION");
      }
      runtime.stdout(meta.version);
      return toRunResult(runtime.getExitCode());
    }

    await runCommand(command, { rawArgs });
    return toRunResult(runtime.getExitCode());
  } catch (error) {
    if (isCrocoCommandExit(error)) {
      return toRunResult(error.exitCode);
    }

    if (isCliError(error)) {
      runtime.stdout(`${await renderHelpUsage(command, rawArgs)}\n`);
      runtime.stderr(error.message);
    } else {
      runtime.stderr(error instanceof Error ? (error.stack ?? error.message) : String(error));
    }

    return toRunResult(1);
  }
}

function createBoundCrocoCommand(runtime: CrocoCommandRuntime): CommandDef<typeof GLOBAL_OPTIONS> {
  const migrateCommand = createMigrateCommand({
    runOptions: getDelegatedCommandRuntimeOptions(runtime),
    onResult(result) {
      if (result.status === "failed" && result.message !== undefined) {
        runtime.stderr(result.message);
      }
      runtime.setExitCode(result.exitCode);
    },
  });
  const command = defineCommand({
    meta: {
      name: "croco",
      description: "Croco framework CLI",
    },
    args: {
      ...GLOBAL_OPTIONS,
    },
    subCommands: {
      make: lazyCommand(
        "make",
        "Generate application source files",
        async () => (await import("./make.js")).make as LoadedCommand,
      ),
      create: lazyCommand(
        "create",
        "Create Croco project files",
        async () => (await import("./create.js")).create as LoadedCommand,
      ),
      generate: lazyCommand(
        "generate",
        "Generate bundled Croco scaffolds",
        async () => (await import("./generate.js")).generate as LoadedCommand,
      ),
      codegen: lazyCommand(
        "codegen",
        "Generate Croco clients and specs",
        async () => (await import("./codegen.js")).codegen as LoadedCommand,
      ),
      contracts: lazyCommand(
        "contracts",
        "Validate Croco contract graph artifacts",
        async () => (await import("./contracts.js")).contracts as LoadedCommand,
      ),
      desktop: lazyCommand(
        "desktop",
        "Generate and validate Croco desktop contract artifacts",
        async () => (await import("./desktop.js")).desktop as LoadedCommand,
      ),
      "architecture-policy": lazyCommand(
        "architecture-policy",
        "Validate Croco static architecture policy manifests",
        async () => (await import("./architecturePolicy.js")).architecturePolicy as LoadedCommand,
      ),
      di: lazyCommand(
        "di",
        "Validate Croco DI graph artifacts",
        async () => (await import("./di.js")).di as LoadedCommand,
      ),
      "runtime-policy": lazyCommand(
        "runtime-policy",
        "Validate Croco runtime policy capability manifests",
        async () => (await import("./runtimePolicy.js")).runtimePolicy as LoadedCommand,
      ),
      doctor,
      migrate: migrateCommand,
      ops: lazyCommand(
        "ops",
        "Inspect Croco operational endpoints",
        async () => (await import("./ops.js")).ops as LoadedCommand,
      ),
      jobs: lazyCommand(
        "jobs",
        "Inspect and recover Croco background jobs",
        async () => (await import("./jobs.js")).jobs as LoadedCommand,
      ),
      project: lazyCommand(
        "project",
        "Inspect Croco project artifacts",
        async () => (await import("./project.js")).project as LoadedCommand,
      ),
      test: lazyCommand(
        "test",
        "Plan Croco test execution from executable assurance artifacts",
        async () => (await import("./test.js")).test as LoadedCommand,
      ),
      upgrade: lazyCommand(
        "upgrade",
        "Report and apply safe Croco version migration codemods",
        async () => (await import("./upgrade.js")).upgrade as LoadedCommand,
      ),
    },
  });

  return bindCommandRuntime(command, runtime);
}

export function normalizeMigrateRootArgs(rawArgs: readonly string[]): string[] {
  const migrateIndex = findRootMigrateIndex(rawArgs);
  if (migrateIndex !== undefined) {
    const subcommandIndex = findMigrateSubcommandIndex(rawArgs, migrateIndex);
    if (subcommandIndex !== undefined) {
      const subcommand = rawArgs[subcommandIndex];
      if (subcommand === undefined || !isMigrateCommand(subcommand)) {
        return [...rawArgs];
      }
      const prefixArgs = rawArgs.slice(0, migrateIndex);
      const parentArgs = rawArgs.slice(migrateIndex + 1, subcommandIndex);
      const leafArgs = rawArgs.slice(subcommandIndex + 1);
      const rootConsumedOption = rawArgs[migrateIndex - 1];
      const parentConsumedOption = rawArgs[subcommandIndex - 1];
      const rootOptionConsumedAsCommand =
        rootConsumedOption !== undefined && migrateOptionConsumesNextArgument(rootConsumedOption);
      const parentOptionConsumedAsCommand =
        parentConsumedOption !== undefined &&
        migrateOptionConsumesNextArgument(parentConsumedOption);

      if (rootOptionConsumedAsCommand || parentOptionConsumedAsCommand) {
        const movedArgs = [...prefixArgs, ...parentArgs].filter(
          (_, index, args) =>
            !(
              (rootOptionConsumedAsCommand && index === prefixArgs.length - 1) ||
              (parentOptionConsumedAsCommand && index === args.length - 1)
            ),
        );
        const consumedOption = parentOptionConsumedAsCommand
          ? parentConsumedOption
          : rootConsumedOption;
        if (consumedOption === undefined) {
          return [...rawArgs];
        }

        const normalizedArgs = [...leafArgs, ...movedArgs, consumedOption];
        return migrateArgumentsAreValid(subcommand, normalizedArgs)
          ? ["migrate", subcommand, consumedOption]
          : ["migrate", subcommand, ...normalizedArgs];
      }

      return ["migrate", subcommand, ...prefixArgs, ...parentArgs, ...leafArgs];
    }
  }

  return [...rawArgs];
}

function normalizeDesktopRootArgs(rawArgs: readonly string[]): string[] {
  const desktopIndex = rawArgs.indexOf("desktop");
  const commandIndex = rawArgs.findIndex(
    (argument, index) => index > desktopIndex && ["generate", "check", "diff"].includes(argument),
  );
  if (desktopIndex === -1 || commandIndex === -1) return [...rawArgs];

  const normalized: string[] = [];
  const cwdArguments: string[] = [];
  for (let index = 0; index < rawArgs.length; index++) {
    const argument = rawArgs[index];
    if (argument?.startsWith("--cwd=")) {
      if (argument.length === "--cwd=".length) return [...rawArgs];
      cwdArguments.push(argument);
      continue;
    }
    if (argument !== "--cwd") {
      if (argument !== undefined) normalized.push(argument);
      continue;
    }
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) return [...rawArgs];
    cwdArguments.push(argument, value);
    index++;
  }
  return [...normalized, ...cwdArguments];
}

function findRootMigrateIndex(rawArgs: readonly string[]): number | undefined {
  return findCommandIndex(rawArgs, 0, (argument) => argument === "migrate");
}

function findMigrateSubcommandIndex(
  rawArgs: readonly string[],
  migrateIndex: number,
): number | undefined {
  return findCommandIndex(rawArgs, migrateIndex + 1, isMigrateCommand);
}

function findCommandIndex(
  rawArgs: readonly string[],
  startIndex: number,
  matchesCommand: (argument: string) => boolean,
): number | undefined {
  for (let index = startIndex; index < rawArgs.length; index++) {
    const argument = rawArgs[index];
    if (argument === undefined) {
      continue;
    }

    if (migrateOptionConsumesNextArgument(argument)) {
      index++;
      continue;
    }

    if (argument.startsWith("-")) {
      continue;
    }

    if (matchesCommand(argument)) {
      return index;
    }
    break;
  }

  const cittyCommandIndex = rawArgs.findIndex(
    (argument, index) => index >= startIndex && !argument.startsWith("-"),
  );
  return cittyCommandIndex !== -1 && matchesCommand(rawArgs[cittyCommandIndex] ?? "")
    ? cittyCommandIndex
    : undefined;
}

function lazyCommand(name: string, description: string, loadCommand: CommandLoader): LoadedCommand {
  return defineCommand({
    meta: {
      name,
      description,
    },
    async run({ rawArgs, data }) {
      const command = await loadCommand();
      await runCommand(command, { rawArgs, data });
    },
  }) as LoadedCommand;
}

function bindCommandRuntime<T extends ArgsDef>(
  command: CommandDef<T>,
  runtime: CrocoCommandRuntime,
): CommandDef<T> {
  const subCommands = bindResolvableSubCommands(command.subCommands, runtime);
  const setup = bindCommandHook(command.setup, runtime);
  const cleanup = bindCommandHook(command.cleanup, runtime);
  const run = bindCommandHook(command.run, runtime);

  return {
    ...command,
    ...(subCommands === undefined ? {} : { subCommands }),
    ...(setup === undefined ? {} : { setup }),
    ...(cleanup === undefined ? {} : { cleanup }),
    ...(run === undefined ? {} : { run }),
  };
}

function bindResolvableSubCommands(
  subCommands: Resolvable<SubCommandsDef> | undefined,
  runtime: CrocoCommandRuntime,
): Resolvable<SubCommandsDef> | undefined {
  if (subCommands === undefined) {
    return undefined;
  }
  if (typeof subCommands === "function") {
    return async () => bindSubCommands(await resolveRequiredValue(subCommands), runtime);
  }
  if (isPromise(subCommands)) {
    return subCommands.then((resolved) => bindSubCommands(resolved, runtime));
  }
  return bindSubCommands(subCommands, runtime);
}

function bindSubCommands(
  subCommands: SubCommandsDef,
  runtime: CrocoCommandRuntime,
): SubCommandsDef {
  return Object.fromEntries(
    Object.entries(subCommands).map(([name, command]) => [
      name,
      bindResolvableCommand(command, runtime),
    ]),
  );
}

function bindResolvableCommand(
  command: SubCommandsDef[string],
  runtime: CrocoCommandRuntime,
): SubCommandsDef[string] {
  if (typeof command === "function") {
    return async () => bindCommandRuntime(await resolveRequiredValue(command), runtime);
  }
  if (isPromise(command)) {
    return command.then((resolved) => bindCommandRuntime(resolved, runtime));
  }
  return bindCommandRuntime(command, runtime);
}

function bindCommandHook<T extends ArgsDef>(
  hook: ((context: CommandContext<T>) => unknown | Promise<unknown>) | undefined,
  runtime: CrocoCommandRuntime,
): ((context: CommandContext<T>) => unknown | Promise<unknown>) | undefined {
  if (hook === undefined) {
    return undefined;
  }

  return (context) => runWithCrocoCommandRuntime(runtime, () => hook(context));
}

async function renderHelpUsage<T extends ArgsDef>(
  command: CommandDef<T>,
  rawArgs: readonly string[],
  parentMeta?: Awaited<ReturnType<typeof resolveCommandMeta>>,
): Promise<string> {
  const subCommands = await resolveValue(command.subCommands);
  if (subCommands !== undefined && Object.keys(subCommands).length > 0) {
    const subCommandIndex = rawArgs.findIndex((argument) => !argument.startsWith("-"));
    const subCommandName = rawArgs[subCommandIndex];
    const subCommand =
      subCommandName === undefined ? undefined : await resolveValue(subCommands[subCommandName]);
    if (subCommand !== undefined) {
      return renderHelpUsage(
        subCommand,
        rawArgs.slice(subCommandIndex + 1),
        await resolveCommandMeta(command),
      );
    }
  }

  const parent = parentMeta === undefined ? undefined : defineCommand<T>({ meta: parentMeta });
  return renderUsage(command, parent);
}

async function resolveCommandMeta<T extends ArgsDef>(command: CommandDef<T>) {
  return resolveValue(command.meta);
}

async function resolveRequiredValue<T>(value: Resolvable<T>): Promise<T> {
  const resolved = await resolveValue(value);
  if (resolved === undefined) {
    throw createCliError("Expected command definition to resolve", "E_COMMAND_RESOLUTION");
  }
  return resolved;
}

async function resolveValue<T>(value: Resolvable<T> | undefined): Promise<T | undefined> {
  if (typeof value === "function") {
    return (value as () => T | Promise<T>)();
  }
  return value;
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

function isCliError(error: unknown): error is Error & { readonly code: string } {
  return (
    error instanceof Error &&
    error.name === "CLIError" &&
    typeof (error as Error & { readonly code?: unknown }).code === "string"
  );
}

function createCliError(message: string, code: string): Error & { readonly code: string } {
  return Object.assign(new Error(message), { name: "CLIError", code });
}

function toRunResult(exitCode: number): CrocoRunResult {
  return { exitCode };
}
