import { defineCommand } from "citty";
import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import {
  getDelegatedCommandRuntimeOptions,
  getDelegatedCommandStdio,
  waitForDelegatedCommand,
} from "../libs/delegatedCommand.js";
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
  async run({ rawArgs }) {
    const runtime = getCrocoCommandRuntime();
    runtime.setExitCode(await runRpcCodegen(rawArgs, getDelegatedCommandRuntimeOptions(runtime)));
  },
});

export function runRpcCodegen(
  args: string[],
  options: {
    readonly resolveBin?: () => string;
    readonly spawn?: RpcCodegenSpawn;
    readonly setExitCode?: (code: number) => void;
    readonly stdout?: (message: string) => void;
    readonly stderr?: (message: string) => void;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly cwd?: string;
    readonly writeError?: (message: string) => void;
  } = {},
): Promise<number> {
  const resolveBin = options.resolveBin ?? resolveRpcCodegenBin;
  const spawnChild = options.spawn ?? spawn;
  const child = spawnChild(process.execPath, [resolveBin(), ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    stdio: getDelegatedCommandStdio(options),
  });

  return waitForDelegatedCommand(child, options);
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
