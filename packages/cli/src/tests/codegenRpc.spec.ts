import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type RpcCodegenSpawn,
  resolveRpcCodegenBinFromEntry,
  runRpcCodegen,
} from "../commands/codegenRpc.js";

describe("codegenRpc", () => {
  it("should resolve a workspace source package entry to the built RPC CLI", () => {
    const root = join("workspace", "packages", "rpc-codegen");

    expect(resolveRpcCodegenBinFromEntry(join(root, "src", "index.ts"))).toBe(
      join(root, "dist", "cli.js"),
    );
  });

  it("should resolve an installed package entry to the sibling RPC CLI", () => {
    const root = join("consumer", "node_modules", "@croco", "rpc-codegen");

    expect(resolveRpcCodegenBinFromEntry(join(root, "dist", "index.js"))).toBe(
      join(root, "dist", "cli.js"),
    );
  });

  it("should spawn the RPC CLI with forwarded args and preserve its exit code", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const exitCodes: number[] = [];
    const spawnRpc: RpcCodegenSpawn = (command, args, options) => {
      calls.push({ command, args, options });
      return child;
    };

    runRpcCodegen(["--controllers", "src/**/*.ts", "--out", "generated"], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnRpc,
      setExitCode: (code) => exitCodes.push(code),
    });
    child.emit("exit", 7);

    expect(calls).toEqual([
      {
        command: process.execPath,
        args: ["/pkg/dist/cli.js", "--controllers", "src/**/*.ts", "--out", "generated"],
        options: { stdio: "inherit" },
      },
    ]);
    expect(calls[0]?.options).not.toHaveProperty("shell");
    expect(exitCodes).toEqual([7]);
  });

  it("should report spawn errors as command failures", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const errors: string[] = [];
    const exitCodes: number[] = [];
    const spawnRpc: RpcCodegenSpawn = () => child;

    runRpcCodegen([], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: spawnRpc,
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
