import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { type RpcCodegenSpawn, runRpcCodegen } from "../commands/codegenRpc.js";

describe("codegenRpc", () => {
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
    child.emit("close", 7);

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

  it("should drain injected output before returning the child exit code", async () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = Object.assign(new EventEmitter(), { stdout, stderr }) as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const output: string[] = [];
    const errors: string[] = [];

    const result = runRpcCodegen(["--check"], {
      resolveBin: () => "/pkg/dist/cli.js",
      spawn: (command, args, options) => {
        calls.push({ command, args, options });
        return child;
      },
      stdout: (message) => output.push(message),
      stderr: (message) => errors.push(message),
    });
    stdout.emit("data", "generated\n");
    stderr.emit("data", "warning\n");
    child.emit("close", 7);

    await expect(result).resolves.toBe(7);
    expect(calls.at(0)?.options.stdio).toEqual(["inherit", "pipe", "pipe"]);
    expect(output).toEqual(["generated\n"]);
    expect(errors).toEqual(["warning\n"]);
  });
});

type SpawnCall = {
  readonly command: string;
  readonly args: string[];
  readonly options: SpawnOptions;
};
