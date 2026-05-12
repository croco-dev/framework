import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { GLOBAL_OPTIONS } from "./options.js";

const getMigrateBinPath = (): string => {
  return require.resolve("@croco/migration-runner/dist/cli.js");
};

const migrateUp = defineCommand({
  meta: {
    name: "up",
    description: "Run pending migrations",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run({ args }) {
    const binPath = getMigrateBinPath();
    const restArgs = args._.slice(1);

    const child = spawn(process.execPath, [binPath, "up", ...restArgs], {
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });

    child.on("error", (err) => {
      console.error(err.message);
      process.exit(1);
    });
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
  run({ args }) {
    const binPath = getMigrateBinPath();
    const restArgs = args._.slice(1);

    const child = spawn(process.execPath, [binPath, "down", ...restArgs], {
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });

    child.on("error", (err) => {
      console.error(err.message);
      process.exit(1);
    });
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
  },
});
