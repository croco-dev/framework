import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  type MigrateCommand,
  type MigrationRunnerSpawn,
  migrate,
  resolveMigrationRunnerBinFromEntry,
  runMigrateCommand,
} from "../commands/migrate.js";

describe("migrate command", () => {
  it("should expose up, down, and status migration subcommands", () => {
    expect(Object.keys(migrate.subCommands ?? {})).toEqual(["up", "down", "status"]);
  });

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
