#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { argv } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { hasFailedBuildTask, readTurboRunSummary } from "./test-lane-runner.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";

export const CANONICAL_TURBO_CACHE_TASKS = ["build", "typecheck", "test:evidence"] as const;

export type TurboCacheOptions = {
  readonly rootDir: string;
  readonly cacheDir: string;
  readonly tasks: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly turboBinary: string;
};

export type TurboCacheWarmResult = {
  readonly exitCode: number;
  readonly attempts: number;
};

export type TurboCachePruneResult = {
  readonly keptHashes: readonly string[];
  readonly removedCount: number;
};

export type CanonicalCacheCliCommand =
  | { readonly mode: "warm"; readonly options: TurboCacheOptions }
  | {
      readonly mode: "prune";
      readonly options: TurboCacheOptions;
      readonly hashListPath: string;
    };

type TurboCacheEntry = {
  readonly name: string;
  readonly hash: string;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_TURBO_BINARY = resolve(ROOT_DIR, "node_modules/.bin/turbo");
const TURBO_CACHE_ENTRY_PATTERN = /^([0-9a-f]{16})(?:\.tar\.zst|-meta\.json|-manifest\.json)$/;
const TURBO_TASK_HASH_PATTERN = /^[0-9a-f]{16}$/;
const DRY_RUN_MAX_BUFFER_BYTES = 256 * 1024 * 1024;

function runWarmAttempt(options: TurboCacheOptions): Promise<{ exitCode: number; output: string }> {
  const args = [
    "run",
    ...options.tasks,
    "--summarize",
    "--concurrency=4",
    "--continue=always",
    `--cache-dir=${resolve(options.cacheDir)}`,
  ];
  return new Promise((resolveAttempt, rejectAttempt) => {
    const child = spawn(options.turboBinary, args, {
      cwd: options.rootDir,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("error", (error) => {
      rejectAttempt(
        new VerificationProblem(
          "TURBO_CACHE_WARM_SPAWN_FAILED",
          "configuration",
          `Could not start ${options.turboBinary}: ${error.message}`,
        ),
      );
    });
    child.on("close", (exitCode, signal) => {
      if (exitCode === null) {
        rejectAttempt(
          new VerificationProblem(
            "TURBO_CACHE_WARM_INTERRUPTED",
            "configuration",
            `${options.turboBinary} ${args.join(" ")} was terminated by ${signal ?? "an unknown signal"}.`,
          ),
        );
        return;
      }
      resolveAttempt({ exitCode, output });
    });
  });
}

export async function warmTurboCache(options: TurboCacheOptions): Promise<TurboCacheWarmResult> {
  const first = await runWarmAttempt(options);
  if (
    first.exitCode === 0 ||
    !hasFailedBuildTask(readTurboRunSummary(options.rootDir, first.output))
  ) {
    return { exitCode: first.exitCode, attempts: 1 };
  }
  const retry = await runWarmAttempt(options);
  return { exitCode: retry.exitCode, attempts: 2 };
}

function assertCacheDirectory(cacheDir: string): void {
  if (statSync(cacheDir, { throwIfNoEntry: false })?.isDirectory() !== true) {
    throw new VerificationProblem(
      "TURBO_CACHE_DIR_MISSING",
      "input",
      `Turbo cache directory does not exist: ${cacheDir}`,
    );
  }
}

function assertCleanWorktree(rootDir: string): void {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: rootDir, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new VerificationProblem(
      "TURBO_CACHE_WORKTREE_STATUS_FAILED",
      "configuration",
      `git status --porcelain failed in ${rootDir}: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
  const changedPaths = result.stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.slice(3));
  if (changedPaths.length > 0) {
    throw new VerificationProblem(
      "TURBO_CACHE_WORKTREE_DIRTY",
      "contract",
      `Turbo task hashes are computed from the working tree, so pruning requires a clean worktree; git status reported: ${changedPaths.join(", ")}`,
    );
  }
}

function dryRunFailure(options: TurboCacheOptions, reason: string): VerificationProblem {
  return new VerificationProblem(
    "TURBO_CACHE_DRY_RUN_FAILED",
    "contract",
    `${options.turboBinary} run ${options.tasks.join(" ")} --dry=json failed: ${reason}`,
  );
}

function readCurrentTaskHashes(options: TurboCacheOptions): ReadonlySet<string> {
  const result = spawnSync(options.turboBinary, ["run", ...options.tasks, "--dry=json"], {
    cwd: options.rootDir,
    env: options.env,
    encoding: "utf8",
    maxBuffer: DRY_RUN_MAX_BUFFER_BYTES,
  });
  if (result.error) throw dryRunFailure(options, result.error.message);
  if (result.status !== 0) {
    throw dryRunFailure(
      options,
      `exit ${result.status ?? result.signal}; stderr=${result.stderr.trim() || "<empty>"}`,
    );
  }
  let plan: unknown;
  try {
    plan = JSON.parse(result.stdout);
  } catch (error) {
    throw dryRunFailure(
      options,
      `stdout is not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const tasks =
    typeof plan === "object" && plan !== null && "tasks" in plan ? plan.tasks : undefined;
  if (!Array.isArray(tasks)) throw dryRunFailure(options, "the plan has no tasks array");
  return new Set(
    tasks.map((task: unknown) => {
      const hash =
        typeof task === "object" && task !== null && "hash" in task ? task.hash : undefined;
      if (typeof hash !== "string" || !TURBO_TASK_HASH_PATTERN.test(hash)) {
        throw dryRunFailure(options, `the plan contains an invalid task hash ${String(hash)}`);
      }
      return hash;
    }),
  );
}

function readCacheEntries(cacheDir: string): readonly TurboCacheEntry[] {
  const names = readdirSync(cacheDir).sort();
  const unexpected = names.filter((name) => !TURBO_CACHE_ENTRY_PATTERN.test(name));
  if (unexpected.length > 0) {
    throw new VerificationProblem(
      "TURBO_CACHE_UNEXPECTED_ENTRY",
      "contract",
      `${cacheDir} contains entries that are not Turbo cache artifacts: ${unexpected.join(", ")}`,
    );
  }
  return names.map((name) => ({ name, hash: name.slice(0, 16) }));
}

export function pruneTurboCache(options: TurboCacheOptions): TurboCachePruneResult {
  const cacheDir = resolve(options.cacheDir);
  assertCacheDirectory(cacheDir);
  assertCleanWorktree(options.rootDir);
  const currentHashes = readCurrentTaskHashes(options);
  const entries = readCacheEntries(cacheDir);
  const staleEntries = entries.filter(({ hash }) => !currentHashes.has(hash));
  for (const { name } of staleEntries) rmSync(join(cacheDir, name));
  const keptHashes = new Set(
    entries.filter(({ hash }) => currentHashes.has(hash)).map(({ hash }) => hash),
  );
  return { keptHashes: [...keptHashes].sort(), removedCount: staleEntries.length };
}

function optionValue(args: readonly string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new VerificationProblem(
      "TURBO_CACHE_ARGUMENT_MISSING",
      "input",
      `${name} requires a path value.`,
    );
  }
  return value;
}

export function parseCanonicalCacheCli(args: readonly string[]): CanonicalCacheCliCommand {
  const [mode, ...rest] = args;
  if (mode !== "warm" && mode !== "prune") {
    throw new VerificationProblem(
      mode === undefined ? "TURBO_CACHE_ARGUMENT_MISSING" : "TURBO_CACHE_ARGUMENT_INVALID",
      "input",
      "Usage: turbo-canonical-cache.mts warm --cache-dir <dir> | prune --cache-dir <dir> --hash-list <file>",
    );
  }
  let cacheDir: string | undefined;
  let hashListPath: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--cache-dir") {
      cacheDir = resolve(optionValue(rest, index, arg));
      index += 1;
    } else if (arg === "--hash-list" && mode === "prune") {
      hashListPath = resolve(optionValue(rest, index, arg));
      index += 1;
    } else {
      throw new VerificationProblem(
        "TURBO_CACHE_ARGUMENT_INVALID",
        "input",
        `Unknown ${mode} option: ${arg}`,
      );
    }
  }
  if (cacheDir === undefined) {
    throw new VerificationProblem(
      "TURBO_CACHE_ARGUMENT_MISSING",
      "input",
      `${mode} requires --cache-dir <dir>.`,
    );
  }
  const options: TurboCacheOptions = {
    rootDir: ROOT_DIR,
    cacheDir,
    tasks: CANONICAL_TURBO_CACHE_TASKS,
    env: process.env,
    turboBinary: REPOSITORY_TURBO_BINARY,
  };
  if (mode === "warm") return { mode, options };
  if (hashListPath === undefined) {
    throw new VerificationProblem(
      "TURBO_CACHE_ARGUMENT_MISSING",
      "input",
      "prune requires --hash-list <file>.",
    );
  }
  return { mode, options, hashListPath };
}

async function main(args: readonly string[]): Promise<number> {
  const command = parseCanonicalCacheCli(args);
  if (command.mode === "warm") {
    const result = await warmTurboCache(command.options);
    console.log(
      `[turbo-canonical-cache] warm exited with ${result.exitCode} after ${result.attempts} attempt(s)`,
    );
    return result.exitCode;
  }
  const result = pruneTurboCache(command.options);
  writeFileSync(command.hashListPath, result.keptHashes.map((hash) => `${hash}\n`).join(""));
  console.log(
    `[turbo-canonical-cache] kept ${result.keptHashes.length} task hashes and removed ${result.removedCount} stale entries`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  main(argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(`turbo-canonical-cache: failed: ${formatVerificationProblem(error)}`);
      process.exitCode = 1;
    },
  );
}
