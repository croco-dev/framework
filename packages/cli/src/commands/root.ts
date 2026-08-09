import { defineCommand, runCommand } from "citty";
import type { SubCommandsDef } from "citty";
import { doctor } from "./doctor.js";
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
      migrate: lazyCommand(
        "migrate",
        "Run Croco database migrations",
        async () => (await import("./migrate.js")).migrate as LoadedCommand,
      ),
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
