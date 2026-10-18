import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runOpenapiSpec } from "../commands/codegenOpenapi.js";
import { runRpcCodegen } from "../commands/codegenRpc.js";
import { createCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { getDelegatedCommandRuntimeOptions } from "../libs/delegatedCommand.js";

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
