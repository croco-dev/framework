import type { ChildProcess, StdioOptions } from "node:child_process";
import { getCrocoCommandRuntime } from "./cliRuntime.js";
import type { CrocoCommandRuntime } from "./cliRuntime.js";

export type DelegatedCommandOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly stdout?: (message: string) => void;
  readonly stderr?: (message: string) => void;
  readonly setExitCode?: (code: number) => void;
  readonly writeError?: (message: string) => void;
};

export function getDelegatedCommandRuntimeOptions(
  runtime: CrocoCommandRuntime,
): DelegatedCommandOptions {
  return {
    ...(runtime.hasInjectedStdout ? { stdout: runtime.stdout } : {}),
    ...(runtime.hasInjectedStderr ? { stderr: runtime.stderr } : {}),
    ...(runtime.hasInjectedEnv ? { env: runtime.env } : {}),
    ...(runtime.hasInjectedCwd ? { cwd: runtime.cwd } : {}),
  };
}

export function getDelegatedCommandStdio(options: DelegatedCommandOptions): StdioOptions {
  return options.stdout === undefined && options.stderr === undefined
    ? "inherit"
    : [
        "inherit",
        options.stdout === undefined ? "inherit" : "pipe",
        options.stderr === undefined ? "inherit" : "pipe",
      ];
}

export function waitForDelegatedCommand(
  child: ChildProcess,
  options: DelegatedCommandOptions,
): Promise<number> {
  const runtime = getCrocoCommandRuntime();
  const setExitCode = options.setExitCode ?? runtime.setExitCode;
  const writeError = options.writeError ?? options.stderr ?? runtime.stderr;

  child.stdout?.on("data", (chunk) => options.stdout?.(String(chunk)));
  child.stderr?.on("data", (chunk) => options.stderr?.(String(chunk)));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      setExitCode(code);
      resolve(code);
    };

    child.on("error", (error) => {
      writeError(error.message);
      finish(1);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
}
