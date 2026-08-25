import { renderUsage } from "citty";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { CommandDef } from "citty";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import {
  type MigrateCommand,
  type MigrationRunnerSpawn,
  migrate,
  resolveMigrationRunnerBinFromEntry,
  runMigrateCommand,
} from "../commands/migrate.js";
import { createCrocoCommand, normalizeMigrateRootArgs } from "../commands/root.js";

describe("migrate command", () => {
  it("should expose up, down, and status migration subcommands", () => {
    expect(Object.keys(migrate.subCommands ?? {})).toEqual(["up", "down", "status"]);
  });

  it("should expose the real migrate command to root help resolution", () => {
    const rootSubCommands = createCrocoCommand().subCommands as Record<string, CommandDef>;

    expect(rootSubCommands.migrate).toBe(migrate);
  });

  it.each([
    [
      ["--cwd", "/workspace/app", "--dryRun", "migrate", "up", "--dry-run"],
      ["migrate", "up", "--cwd", "/workspace/app", "--dryRun", "--dry-run"],
    ],
    [
      ["migrate", "--cwd=/workspace/app", "--overwrite", "down"],
      ["migrate", "down", "--cwd=/workspace/app", "--overwrite"],
    ],
    [
      ["--dryRun", "--bogus", "migrate", "up"],
      ["migrate", "up", "--dryRun", "--bogus"],
    ],
    [
      ["migrate", "--overwrite", "--bogus", "up"],
      ["migrate", "up", "--overwrite", "--bogus"],
    ],
    [
      ["--cwd", "migrate", "up"],
      ["migrate", "up", "--cwd"],
    ],
    [
      ["--cwd", "migrate", "--bogus", "up"],
      ["migrate", "up", "--bogus", "--cwd"],
    ],
    [
      ["--cwd", "migrate", "migrate", "up"],
      ["migrate", "up", "--cwd", "migrate"],
    ],
    [
      ["migrate", "--cwd", "up", "up"],
      ["migrate", "up", "--cwd", "up"],
    ],
  ])("should move root migrate options across the subcommand boundary", (rawArgs, expected) => {
    expect(normalizeMigrateRootArgs(rawArgs)).toEqual(expected);
  });

  it("should leave unrelated command arguments unchanged", () => {
    const rawArgs = ["--dryRun", "make", "controller", "migrate", "up"];

    expect(normalizeMigrateRootArgs(rawArgs)).toEqual(rawArgs);
  });

  it.each(["up", "down", "status"] as const)(
    "should document only the options supported by migrate %s",
    async (command) => {
      const subCommands = migrate.subCommands as Record<MigrateCommand, CommandDef>;
      const subCommand = subCommands[command];
      const usage = await renderUsage(subCommand, migrate);

      expect(usage).toContain("--cwd=<path>");
      expect(usage).toContain("--dir=<path>");
      expect(usage).toContain("--connection=<url>");
      expect(usage).toContain("--table=<name>");
      expect(usage).toContain("--dialect=<dialect>");
      expect(usage).not.toContain("--overwrite");
      expect(usage.includes("--dryRun")).toBe(command !== "status");
      expect(usage.includes("--target=<id>")).toBe(command !== "status");
      expect(usage.includes("--count=<number>")).toBe(command === "down");
    },
  );

  it("should resolve workspace and installed migration runner entries to the built CLI", () => {
    expect(
      resolveMigrationRunnerBinFromEntry("/workspace/packages/migration-runner/src/index.ts"),
    ).toBe("/workspace/packages/migration-runner/dist/cli.js");
    expect(
      resolveMigrationRunnerBinFromEntry(
        "/consumer/node_modules/@croco/migration-runner/dist/index.js",
      ),
    ).toBe("/consumer/node_modules/@croco/migration-runner/dist/cli.js");
  });

  it.each<MigrateCommand>(["up", "down", "status"])(
    "should delegate %s to the migration runner CLI",
    (command) => {
      const child = new EventEmitter() as unknown as ChildProcess;
      const calls: SpawnCall[] = [];
      const exitCodes: number[] = [];
      const spawnMigrationRunner: MigrationRunnerSpawn = (commandPath, args, options) => {
        calls.push({ command: commandPath, args, options });
        return child;
      };

      runMigrateCommand(command, ["--dir", "migrations", "--connection", "postgres://db"], {
        resolveBin: () => "/pkg/dist/cli.js",
        spawn: spawnMigrationRunner,
        setExitCode: (code) => exitCodes.push(code),
      });
      child.emit("exit", 0);

      expect(calls).toEqual([
        {
          command: process.execPath,
          args: [
            "/pkg/dist/cli.js",
            command,
            "--dir",
            "migrations",
            "--connection",
            "postgres://db",
          ],
          options: { stdio: "inherit" },
        },
      ]);
      expect(calls.at(0)?.options).not.toHaveProperty("shell");
      expect(exitCodes).toEqual([0]);
    },
  );

  it("should consume cwd and translate migration options to one canonical child argv", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const spawnMigrationRunner: MigrationRunnerSpawn = (commandPath, args, options) => {
      calls.push({ command: commandPath, args, options });
      return child;
    };

    runMigrateCommand(
      "up",
      [
        "--cwd",
        "/workspace/app",
        "-d",
        "-migrations",
        "--target",
        "-1",
        "-cpostgres://db",
        "--table",
        "croco_migrations",
        "--dialect",
        "postgres",
        "--dryRun",
        "--dry-run",
      ],
      {
        resolveBin: () => "/pkg/dist/cli.js",
        spawn: spawnMigrationRunner,
      },
    );

    expect(calls).toEqual([
      {
        command: process.execPath,
        args: [
          "/pkg/dist/cli.js",
          "up",
          "--dir",
          "-migrations",
          "--target",
          "-1",
          "--connection",
          "postgres://db",
          "--table",
          "croco_migrations",
          "--dialect",
          "postgres",
          "--dry-run",
        ],
        options: { cwd: "/workspace/app", stdio: "inherit" },
      },
    ]);
  });

  it.each<[MigrateCommand, string[], string]>([
    ["up", ["--overwrite"], "Unknown option: --overwrite"],
    ["up", ["--count", "1"], "Unknown option: --count"],
    ["status", ["--dryRun"], "Unknown option: --dryRun"],
    ["status", ["--target", "20260826"], "Unknown option: --target"],
  ])(
    "should reject unsupported migrate %s options before spawning the child",
    (command, args, message) => {
      const errors: string[] = [];
      const exitCodes: number[] = [];
      let spawnCalls = 0;
      const spawnMigrationRunner: MigrationRunnerSpawn = () => {
        spawnCalls++;
        return new EventEmitter() as unknown as ChildProcess;
      };

      runMigrateCommand(command, args, {
        spawn: spawnMigrationRunner,
        setExitCode: (code) => exitCodes.push(code),
        writeError: (message) => errors.push(message),
      });

      expect(errors).toEqual([message]);
      expect(exitCodes).toEqual([1]);
      expect(spawnCalls).toBe(0);
    },
  );

  it("should report spawn errors as migration command failures", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const errors: string[] = [];
    const exitCodes: number[] = [];
    const spawnMigrationRunner: MigrationRunnerSpawn = () => child;

    runMigrateCommand("status", [], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnMigrationRunner,
      setExitCode: (code) => exitCodes.push(code),
      writeError: (message) => errors.push(message),
    });
    child.emit("error", new Error("spawn failed"));

    expect(errors).toEqual(["spawn failed"]);
    expect(exitCodes).toEqual([1]);
  });
});

type SpawnCall = {
  readonly command: string;
  readonly args: string[];
  readonly options: SpawnOptions;
};
