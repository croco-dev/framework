import { defineCommand } from "citty";
import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { GLOBAL_OPTIONS } from "./options.js";

const require = createRequire(import.meta.url);

export type RpcCodegenSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export const codegenRpc = defineCommand({
  meta: {
    name: "rpc",
    description: "Generate RPC clients",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run({ rawArgs }) {
    runRpcCodegen(rawArgs);
  },
});

export function runRpcCodegen(
  args: string[],
  options: {
    readonly resolveBin?: () => string;
    readonly spawn?: RpcCodegenSpawn;
    readonly setExitCode?: (code: number) => void;
    readonly writeError?: (message: string) => void;
  } = {},
): void {
  const resolveBin = options.resolveBin ?? resolveRpcCodegenBin;
  const spawnChild = options.spawn ?? spawn;
  const setExitCode =
    options.setExitCode ??
    ((code: number) => {
      process.exitCode = code;
    });
  const writeError = options.writeError ?? ((message: string) => console.error(message));
  const child = spawnChild(process.execPath, [resolveBin(), ...args], {
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    setExitCode(code ?? 1);
  });

  child.on("error", (error) => {
    writeError(error.message);
    setExitCode(1);
  });
}

export function resolveRpcCodegenBin(): string {
  return resolveRpcCodegenBinFromEntry(require.resolve("@croco/rpc-codegen"));
}

export function resolveRpcCodegenBinFromEntry(entry: string): string {
  const entryDir = dirname(entry);

  return basename(entryDir) === "src"
    ? join(dirname(entryDir), "dist", "cli.js")
    : join(entryDir, "cli.js");
}
