#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { getVerificationCommand } from "./verification-manifest.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";

export type VerificationCommandExecutor = (
  executable: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
) => number | null;

const defaultExecutor: VerificationCommandExecutor = (executable, args, environment) => {
  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: environment,
  });
  if (result.error) throw result.error;
  return result.status;
};

export function runVerificationCommand(
  id: string,
  forwardedArgs: readonly string[] = [],
  executor: VerificationCommandExecutor = defaultExecutor,
): number {
  const definition = getVerificationCommand(id);
  const [executable, ...definedArgs] = definition.command;
  if (!executable) {
    throw new VerificationProblem(
      "VERIFICATION_EXECUTABLE_MISSING",
      "configuration",
      `Verification command ${id} has no executable.`,
    );
  }
  const args = forwardedArgs[0] === "--" ? forwardedArgs.slice(1) : forwardedArgs;
  const environment =
    id === "core-coverage"
      ? { ...process.env, CORE_COVERAGE: "true", SKIP_ENV_VALIDATION: "true" }
      : process.env;
  return executor(executable, [...definedArgs, ...args], environment) ?? 1;
}

function main(args: readonly string[]): number {
  if (args[0] !== "--id" || !args[1]) {
    throw new VerificationProblem(
      "INVALID_VERIFICATION_COMMAND_ARGUMENTS",
      "input",
      "Usage: verification-command.mts --id <stable-command-id> [-- <args...>]",
    );
  }
  return runVerificationCommand(args[1], args.slice(2));
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    process.exitCode = main(argv.slice(2));
  } catch (error) {
    console.error(`verification-command: failed: ${formatVerificationProblem(error)}`);
    process.exitCode = 1;
  }
}
