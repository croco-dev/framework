import { defineCommand } from "citty";
import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import {
  getDelegatedCommandRuntimeOptions,
  getDelegatedCommandStdio,
  waitForDelegatedCommand,
} from "../libs/delegatedCommand.js";
import { parseCodegenInvocation } from "../libs/codegenInvocation.js";
import { GLOBAL_OPTIONS } from "./options.js";
import { resolveCliBinFromEntry } from "./resolveCliBin.js";

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
  const invocation = parseCodegenInvocation(args, options.cwd);
  if ("diagnostic" in invocation) {
    const runtime = getCrocoCommandRuntime();
    (options.writeError ?? options.stderr ?? runtime.stderr)(invocation.diagnostic);
    (options.setExitCode ?? runtime.setExitCode)(1);
    return Promise.resolve(1);
  }
  const resolveBin = options.resolveBin ?? resolveRpcCodegenBin;
  const spawnChild = options.spawn ?? spawn;
  const child = spawnChild(process.execPath, [resolveBin(), ...invocation.args], {
    ...(invocation.cwd === undefined ? {} : { cwd: invocation.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    stdio: getDelegatedCommandStdio(options),
  });

  return waitForDelegatedCommand(child, options);
}

export function resolveRpcCodegenBin(): string {
  return resolveRpcCodegenBinFromEntry(require.resolve("@croco/rpc-codegen"));
}

export function resolveRpcCodegenBinFromEntry(entry: string): string {
  return resolveCliBinFromEntry(entry);
}
