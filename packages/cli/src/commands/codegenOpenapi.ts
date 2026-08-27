import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { defineCommand } from "citty";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import {
  getDelegatedCommandRuntimeOptions,
  getDelegatedCommandStdio,
  waitForDelegatedCommand,
} from "../libs/delegatedCommand.js";
import { GLOBAL_OPTIONS } from "./options.js";
import { resolveCliBinFromEntry } from "./resolveCliBin.js";

const require = createRequire(import.meta.url);

export type OpenapiSpecSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export const codegenOpenapi = defineCommand({
  meta: {
    name: "openapi",
    description: "Generate OpenAPI documents",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    const runtime = getCrocoCommandRuntime();
    runtime.setExitCode(await runOpenapiSpec(rawArgs, getDelegatedCommandRuntimeOptions(runtime)));
  },
});

export function runOpenapiSpec(
  args: string[],
  options: {
    readonly resolveBin?: () => string;
    readonly setExitCode?: (code: number) => void;
    readonly spawn?: OpenapiSpecSpawn;
    readonly stdout?: (message: string) => void;
    readonly stderr?: (message: string) => void;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly cwd?: string;
    readonly writeError?: (message: string) => void;
  } = {},
): Promise<number> {
  const resolveBin = options.resolveBin ?? resolveOpenapiSpecBin;
  const spawnChild = options.spawn ?? spawn;
  const child = spawnChild(process.execPath, [resolveBin(), ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    stdio: getDelegatedCommandStdio(options),
  });

  return waitForDelegatedCommand(child, options);
}

export function resolveOpenapiSpecBin(): string {
  return resolveOpenapiSpecBinFromEntry(require.resolve("@croco/openapi-spec"));
}

export function resolveOpenapiSpecBinFromEntry(entry: string): string {
  return resolveCliBinFromEntry(entry);
}
