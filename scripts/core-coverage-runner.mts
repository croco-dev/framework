#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { CORE_COVERAGE_PACKAGES } from "./core-coverage-config.mts";

export const CORE_COVERAGE_BUILD_COMMAND = [
  "pnpm",
  "turbo",
  "run",
  "build",
  ...CORE_COVERAGE_PACKAGES.map((packageName) => `--filter=${packageName}...`),
] as const;

export const CORE_COVERAGE_TEST_COMMAND = [
  "pnpm",
  "turbo",
  "run",
  "test:coverage",
  // Each task runs one Vitest worker, so two tasks at a time bounds the total worker count.
  "--concurrency=2",
  ...CORE_COVERAGE_PACKAGES.flatMap((packageName) => ["--filter", packageName]),
] as const;

export type CoreCoverageCommandExecutor = (
  executable: string,
  args: readonly string[],
) => number | null;

const defaultExecutor: CoreCoverageCommandExecutor = (executable, args) => {
  const result = spawnSync(executable, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status;
};

export function runCoreCoverage(
  forwardedArgs: readonly string[] = [],
  executor: CoreCoverageCommandExecutor = defaultExecutor,
): number {
  const [buildExecutable, ...buildArgs] = CORE_COVERAGE_BUILD_COMMAND;
  const buildStatus = executor(buildExecutable, buildArgs);
  if (buildStatus !== 0) return buildStatus ?? 1;

  const [testExecutable, ...testArgs] = CORE_COVERAGE_TEST_COMMAND;
  const vitestArgs = forwardedArgs.length > 0 ? ["--", ...forwardedArgs] : [];
  return executor(testExecutable, [...testArgs, ...vitestArgs]) ?? 1;
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  process.exitCode = runCoreCoverage(argv.slice(2));
}
