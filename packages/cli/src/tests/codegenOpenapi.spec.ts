import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type OpenapiSpecSpawn,
  resolveOpenapiSpecBinFromEntry,
  runOpenapiSpec,
} from "../commands/codegenOpenapi.js";
import { createCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { getDelegatedCommandRuntimeOptions } from "../libs/delegatedCommand.js";

describe("codegenOpenapi", () => {
  it("should resolve a workspace source package entry to the built OpenAPI CLI", () => {
    const root = join("workspace", "packages", "openapi-spec");

    expect(resolveOpenapiSpecBinFromEntry(join(root, "src", "index.ts"))).toBe(
      join(root, "dist", "cli.js"),
    );
  });

  it("should resolve an installed package entry to the sibling OpenAPI CLI", () => {
    const root = join("consumer", "node_modules", "@croco", "openapi-spec");

    expect(resolveOpenapiSpecBinFromEntry(join(root, "dist", "index.js"))).toBe(
      join(root, "dist", "cli.js"),
    );
  });

  it("should spawn the OpenAPI CLI with forwarded args and preserve its exit code", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const calls: SpawnCall[] = [];
    const exitCodes: number[] = [];
    const spawnOpenapi: OpenapiSpecSpawn = (command, args, options) => {
      calls.push({ command, args, options });
      return child;
    };

    runOpenapiSpec(["--controllers", "src/**/*.ts", "--out", "openapi.json"], {
      resolveBin: () => "/pkg/dist/cli.js",
      setExitCode: (code) => exitCodes.push(code),
      spawn: spawnOpenapi,
    });
    child.emit("close", 7);

    expect(calls).toEqual([
      {
        command: process.execPath,
        args: ["/pkg/dist/cli.js", "--controllers", "src/**/*.ts", "--out", "openapi.json"],
        options: { stdio: "inherit" },
      },
    ]);
    expect(calls.at(0)?.options).not.toHaveProperty("shell");
    expect(exitCodes).toEqual([7]);
  });

  it("should report spawn errors as command failures", () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const errors: string[] = [];
    const exitCodes: number[] = [];
    const spawnOpenapi: OpenapiSpecSpawn = () => child;

    runOpenapiSpec([], {
      resolveBin: () => "/pkg/dist/cli.js",
      setExitCode: (code) => exitCodes.push(code),
      spawn: spawnOpenapi,
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

    const result = runOpenapiSpec(["--check"], {
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

  it.each([
    {
      dependencies: { stdout: () => undefined },
      expectedStdio: ["inherit", "pipe", "inherit"],
      label: "stdout only",
    },
    {
      dependencies: { stderr: () => undefined },
      expectedStdio: ["inherit", "inherit", "pipe"],
      label: "stderr only",
    },
  ])(
    "should pipe $label when delegating from the root runtime",
    ({ dependencies, expectedStdio }) => {
      const child = new EventEmitter() as unknown as ChildProcess;
      const calls: SpawnCall[] = [];
      const runtime = createCrocoCommandRuntime(dependencies);

      runOpenapiSpec(["--check"], {
        ...getDelegatedCommandRuntimeOptions(runtime),
        resolveBin: () => "/pkg/dist/cli.js",
        spawn: (command, args, options) => {
          calls.push({ command, args, options });
          return child;
        },
      });

      expect(calls.at(0)?.options.stdio).toEqual(expectedStdio);
      child.emit("close", 0);
    },
  );
});

type SpawnCall = {
  readonly args: string[];
  readonly command: string;
  readonly options: SpawnOptions;
};
