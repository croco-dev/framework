import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import { runOpenapiSpec } from "../commands/codegenOpenapi.js";
import { createCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { getDelegatedCommandRuntimeOptions } from "../libs/delegatedCommand.js";
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

describe.each([
  ["rpc", runRpcCodegen],
  ["openapi", runOpenapiSpec],
] as const)("%s codegen working directory", (_name, runCodegen) => {
  it.each([
    { args: ["--cwd", "/apps/target"], injected: "/apps/runtime", expected: "/apps/target" },
    { args: ["--cwd=../target app"], injected: "/apps/runtime", expected: "/apps/target app" },
    { args: ["--cwd", "target"], injected: undefined, expected: resolve("target") },
    { args: [], injected: "/apps/runtime", expected: "/apps/runtime" },
    {
      args: ["--cwd", "first", "--cwd=second"],
      injected: "/apps/runtime",
      expected: "/apps/runtime/second",
    },
  ])("uses CLI cwd over runtime cwd: $args", async ({ args, injected, expected }) => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const runtime = createCrocoCommandRuntime({ cwd: injected, env: { CODEGEN_TEST: "injected" } });
    const result = runCodegen(
      ["--controllers", "src/**/*.ts", ...args, "--out", "generated", "--check"],
      {
        ...getDelegatedCommandRuntimeOptions(runtime),
        resolveBin: () => "/pkg/cli.js",
        spawn: (command, args, options) => {
          calls.push({ command, args, options });
          return child;
        },
        setExitCode: runtime.setExitCode,
      },
    );
    child.emit("close", 0);
    expect(await result).toBe(0);
    expect(calls).toEqual([
      {
        command: process.execPath,
        args: ["/pkg/cli.js", "--controllers", "src/**/*.ts", "--out", "generated", "--check"],
        options: { cwd: expected, env: { CODEGEN_TEST: "injected" }, stdio: "inherit" },
      },
    ]);
  });

  it.each([{ args: ["--cwd"] }, { args: ["--cwd="] }, { args: ["--cwd", "--check"] }])(
    "rejects missing cwd before spawning: $args",
    async ({ args }) => {
      const errors: string[] = [];
      let spawned = false;
      const exitCodes: number[] = [];
      const result = await runCodegen(args, {
        resolveBin: () => {
          throw new Error("Must not resolve a binary for invalid cwd");
        },
        spawn: () => {
          spawned = true;
          return new EventEmitter() as unknown as ChildProcess;
        },
        stderr: (message) => errors.push(message),
        setExitCode: (code) => exitCodes.push(code),
      });
      expect(result).toBe(1);
      expect(spawned).toBe(false);
      expect(errors.join("\n")).toContain("--cwd <path>");
      expect(exitCodes).toEqual([1]);
    },
  );
});
