import { defineCommand, runCommand } from "citty";
import type { SubCommandsDef } from "citty";
import { doctor } from "./doctor.js";
import {
  isMigrateCommand,
  migrate,
  migrateArgumentsAreValid,
  migrateOptionConsumesNextArgument,
} from "./migrate.js";
import { GLOBAL_OPTIONS } from "./options.js";

type LoadedCommand = Awaited<Extract<SubCommandsDef[string], Promise<unknown>>>;
type CommandLoader = () => Promise<LoadedCommand>;

export function createCrocoCommand() {
  return defineCommand({
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
      migrate,
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
