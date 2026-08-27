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
      ["--dir", "migrations", "migrate", "up"],
      ["migrate", "up", "--dir", "migrations"],
    ],
    [
      ["-d", "migrations", "migrate", "status"],
      ["migrate", "status", "-d", "migrations"],
    ],
    [
      ["migrate", "--target", "20260826", "up"],
      ["migrate", "up", "--target", "20260826"],
    ],
    [
      ["--cwd", "migrate", "up"],
      ["migrate", "up", "--cwd"],
    ],
    [
      ["--dir", "migrate", "up"],
      ["migrate", "up", "--dir"],
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
    [
      ["--dir", "migrate", "--cwd", "up"],
      ["migrate", "up", "--cwd"],
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
    async (command) => {
      const child = new EventEmitter() as unknown as ChildProcess;
      const calls: SpawnCall[] = [];
      const spawnMigrationRunner: MigrationRunnerSpawn = (commandPath, args, options) => {
        calls.push({ command: commandPath, args, options });
        return child;
      };

      const result = runMigrateCommand(
        command,
        ["--dir", "migrations", "--connection", "postgres://db"],
        {
          resolveBin: () => "/pkg/dist/cli.js",
          spawn: spawnMigrationRunner,
        },
      );
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
      await expect(result).resolves.toEqual({ exitCode: 0, status: "completed" });
    },
  );

  it("should consume cwd and translate migration options to one canonical child argv", async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const spawnMigrationRunner: MigrationRunnerSpawn = (commandPath, args, options) => {
      calls.push({ command: commandPath, args, options });
      return child;
    };

    const result = runMigrateCommand(
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
    child.emit("exit", 0);
    await expect(result).resolves.toEqual({ exitCode: 0, status: "completed" });
  });

  it.each<[MigrateCommand, string[], string]>([
    ["up", ["--overwrite"], "Unknown option: --overwrite"],
    ["up", ["--count", "1"], "Unknown option: --count"],
    ["status", ["--dryRun"], "Unknown option: --dryRun"],
    ["status", ["--target", "20260826"], "Unknown option: --target"],
  ])(
    "should reject unsupported migrate %s options before spawning the child",
    async (command, args, message) => {
      let spawnCalls = 0;
      const spawnMigrationRunner: MigrationRunnerSpawn = () => {
        spawnCalls++;
        return new EventEmitter() as unknown as ChildProcess;
      };

      const result = await runMigrateCommand(command, args, {
        spawn: spawnMigrationRunner,
      });

      expect(result).toEqual({
        exitCode: 1,
        message,
        reason: "invalid-arguments",
        status: "failed",
      });
      expect(spawnCalls).toBe(0);
    },
  );

  it.each([
    {
      expected: ["migrate", "up", "--cwd"],
      message: "Option --cwd requires a value",
      rawArgs: ["--dir", "migrate", "--cwd", "up"],
    },
    {
      expected: ["migrate", "up", "--target"],
      message: "Option --target requires a value",
      rawArgs: ["--target", "migrate", "up", "--dir"],
    },
  ])(
    "should reject malformed command-token values before spawning the child: $rawArgs",
    async ({ expected, message, rawArgs }) => {
      const normalizedArgs = normalizeMigrateRootArgs(rawArgs);
      let spawnCalls = 0;

      expect(normalizedArgs).toEqual(expected);

      const result = await runMigrateCommand("up", normalizedArgs.slice(2), {
        spawn: () => {
          spawnCalls++;
          return new EventEmitter() as unknown as ChildProcess;
        },
      });

      expect(result).toEqual({
        exitCode: 1,
        message,
        reason: "invalid-arguments",
        status: "failed",
      });
      expect(spawnCalls).toBe(0);
    },
  );

  it("should report spawn errors as migration command failures", async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMigrationRunner: MigrationRunnerSpawn = () => child;

    const result = runMigrateCommand("status", [], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnMigrationRunner,
    });
    child.emit("error", new Error("spawn failed"));

    await expect(result).resolves.toEqual({
      exitCode: 1,
      message: "spawn failed",
      reason: "launch-failed",
      status: "failed",
    });
  });

  it("should return synchronous migration runner launch failures", async () => {
    await expect(
      runMigrateCommand("status", [], {
        resolveBin: () => "/pkg/dist/cli.js",
        spawn: () => {
          throw new Error("launch failed");
        },
      }),
    ).resolves.toEqual({
      exitCode: 1,
      message: "launch failed",
      reason: "launch-failed",
      status: "failed",
    });
  });

  it("should return non-zero migration runner exits without mutating process state", async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const originalExitCode = process.exitCode;
    const result = runMigrateCommand("status", [], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: () => child,
    });

    child.emit("exit", 7);

    await expect(result).resolves.toEqual({
      exitCode: 7,
      reason: "runner-exit",
      status: "failed",
    });
    expect(process.exitCode).toBe(originalExitCode);
  });
});

type SpawnCall = {
  readonly command: string;
  readonly args: string[];
  readonly options: SpawnOptions;
};
