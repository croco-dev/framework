import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type ContractsCheckSpawn,
  resolveRpcCodegenBinFromEntry,
  runContractsCheck,
} from "../commands/contractsCheck.js";

describe("contractsCheck", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should resolve a workspace source RPC package entry to the built RPC CLI", () => {
    const root = join("workspace", "packages", "rpc-codegen");

    expect(resolveRpcCodegenBinFromEntry(join(root, "src", "index.ts"))).toBe(
      join(root, "dist", "cli.js"),
    );
  });

  it("should spawn the RPC check mode with forwarded args and preserve its exit code", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const exitCodes: number[] = [];
    const spawnCheck: ContractsCheckSpawn = (command, args, options) => {
      calls.push({ command, args, options });
      return child;
    };

    runContractsCheck(["--controllers", "src/**/*.ts"], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnCheck,
      setExitCode: (code) => exitCodes.push(code),
    });
    child.emit("exit", 7);

    expect(calls).toEqual([
      {
        command: process.execPath,
        args: ["/pkg/dist/cli.js", "--check", "--controllers", "src/**/*.ts"],
        options: { stdio: "inherit" },
      },
    ]);
    expect(exitCodes).toEqual([7]);
  });

  it("should report spawn errors as command failures", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const errors: string[] = [];
    const exitCodes: number[] = [];
    const spawnCheck: ContractsCheckSpawn = () => child;

    runContractsCheck([], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnCheck,
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
