import { AsyncLocalStorage } from "node:async_hooks";
import type { WriteResult } from "./fileWriter.js";

export type CrocoCommandDependencies = {
  readonly stdout?: (message: string) => void;
  readonly stderr?: (message: string) => void;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly isTTY?: boolean;
};

export type CrocoCommandRuntime = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly isTTY: boolean;
  readonly hasInjectedStdout: boolean;
  readonly hasInjectedStderr: boolean;
  readonly hasInjectedEnv: boolean;
  readonly hasInjectedCwd: boolean;
  readonly setExitCode: (exitCode: number) => void;
  readonly exit: (exitCode: number) => never;
  readonly getExitCode: () => number;
};

const runtimeStorage = new AsyncLocalStorage<CrocoCommandRuntime>();

export function createCrocoCommandRuntime(
  dependencies: CrocoCommandDependencies = {},
): CrocoCommandRuntime {
  let exitCode = 0;

  return {
    stdout: dependencies.stdout ?? ((message) => console.log(message)),
    stderr: dependencies.stderr ?? ((message) => console.error(message)),
    cwd: dependencies.cwd ?? process.cwd(),
    env: dependencies.env ?? process.env,
    isTTY: dependencies.isTTY ?? Boolean(process.stdout.isTTY),
    hasInjectedStdout: dependencies.stdout !== undefined,
    hasInjectedStderr: dependencies.stderr !== undefined,
    hasInjectedEnv: dependencies.env !== undefined,
    hasInjectedCwd: dependencies.cwd !== undefined,
    setExitCode(code) {
      exitCode = code;
    },
    exit(code): never {
      exitCode = code;
      throw new CrocoCommandExit(code);
    },
    getExitCode: () => exitCode,
  };
}

export function runWithCrocoCommandRuntime<T>(runtime: CrocoCommandRuntime, callback: () => T): T {
  return runtimeStorage.run(runtime, callback);
}

export function getCrocoCommandRuntime(): CrocoCommandRuntime {
  return runtimeStorage.getStore() ?? createProcessRuntime();
}

export function isCrocoCommandExit(error: unknown): error is CrocoCommandExit {
  return error instanceof CrocoCommandExit;
}

function createProcessRuntime(): CrocoCommandRuntime {
  return {
    stdout: (message) => console.log(message),
    stderr: (message) => console.error(message),
    cwd: process.cwd(),
    env: process.env,
    isTTY: Boolean(process.stdout.isTTY),
    hasInjectedStdout: false,
    hasInjectedStderr: false,
    hasInjectedEnv: false,
    hasInjectedCwd: false,
    setExitCode(exitCode) {
      process.exitCode = exitCode;
    },
    exit: (exitCode): never => process.exit(exitCode),
    getExitCode: () => (typeof process.exitCode === "number" ? process.exitCode : 0),
  };
}

class CrocoCommandExit extends Error {
  constructor(readonly exitCode: number) {
    super(`Croco command requested exit ${exitCode}`);
  }
}

export function renderWriteResult(result: WriteResult): readonly string[] {
  switch (result.status) {
    case "created":
      return [`Created: ${result.path}`];
    case "overwritten":
      return [`Overwritten: ${result.path}`];
    case "skipped-dry-run":
      return result.diff
        ? [`[Dry run] Would create: ${result.path}`, result.diff]
        : [`[Dry run] Would create: ${result.path}`];
    case "exists-no-overwrite":
      return [`Skipped (exists): ${result.path}`];
  }
}

export function logWriteResult(result: WriteResult | null): void {
  if (!result) return;

  for (const message of renderWriteResult(result)) {
    getCrocoCommandRuntime().stdout(message);
  }
}
