import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { defineCommand } from "citty";
import { GLOBAL_OPTIONS } from "./options.js";

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
  run({ rawArgs }) {
    runOpenapiSpec(rawArgs);
  },
});

export function runOpenapiSpec(
  args: string[],
  options: {
    readonly resolveBin?: () => string;
    readonly setExitCode?: (code: number) => void;
    readonly spawn?: OpenapiSpecSpawn;
    readonly writeError?: (message: string) => void;
  } = {},
): void {
  const resolveBin = options.resolveBin ?? resolveOpenapiSpecBin;
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

  child.on("error", (error) => {
    writeError(error.message);
    setExitCode(1);
  });
  child.on("exit", (code) => {
    setExitCode(code ?? 1);
  });
}

export function resolveOpenapiSpecBin(): string {
  return resolveOpenapiSpecBinFromEntry(require.resolve("@croco/openapi-spec"));
}

export function resolveOpenapiSpecBinFromEntry(entry: string): string {
  const entryDir = dirname(entry);

  return basename(entryDir) === "src"
    ? join(dirname(entryDir), "dist", "cli.js")
    : join(entryDir, "cli.js");
}
