#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { env, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { apiDocPackages } from "../packages/docs/api-docs.config.mjs";

type FileSnapshot = { readonly bytes: Buffer; readonly executable: boolean };
type TurboRunSummary = {
  readonly execution?: {
    readonly command?: string;
    readonly startTime?: number;
  };
  readonly tasks?: readonly {
    readonly cache?: { readonly status?: string };
    readonly taskId?: string;
  }[];
};

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TURBO_BINARY = join(REPOSITORY_ROOT, "node_modules", ".bin", "turbo");
const DOCS_BUILD_TASK = "@croco/docs#docs:build";
const DOCS_DIST = join(REPOSITORY_ROOT, "packages", "docs", "dist");
const MODEL_OUTPUTS = apiDocPackages.map(({ directory }) =>
  join(REPOSITORY_ROOT, "packages", directory, ".turbo", "docs-api", "model.json"),
);
const EXECUTION_TIMEOUT_MS = 20 * 60 * 1000;

function trackedPaths(): readonly string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function snapshotTracked(): ReadonlyMap<string, FileSnapshot> {
  const snapshot = new Map<string, FileSnapshot>();
  for (const path of trackedPaths()) {
    const absolutePath = join(REPOSITORY_ROOT, path);
    if (!existsSync(absolutePath)) continue;
    const stat = lstatSync(absolutePath);
    if (!stat.isFile()) continue;
    snapshot.set(path, {
      bytes: readFileSync(absolutePath),
      executable: (stat.mode & 0o111) !== 0,
    });
  }
  return snapshot;
}

function assertTrackedUnchanged(before: ReadonlyMap<string, FileSnapshot>): void {
  const after = snapshotTracked();
  const paths = new Set([...before.keys(), ...after.keys()]);
  const changed = [...paths].filter((path) => {
    const previous = before.get(path);
    const current = after.get(path);
    return (
      !previous ||
      !current ||
      previous.executable !== current.executable ||
      !previous.bytes.equals(current.bytes)
    );
  });
  if (changed.length > 0) {
    throw new Error(`docs build changed tracked files: ${changed.sort().join(", ")}`);
  }
}

function summaryFiles(): ReadonlySet<string> {
  const directory = join(REPOSITORY_ROOT, ".turbo", "runs");
  return existsSync(directory) ? new Set(readdirSync(directory)) : new Set();
}

function runDocsBuild(cacheDirectory: string): TurboRunSummary {
  const before = summaryFiles();
  const startedAt = Date.now();
  const environment = { ...env, TURBO_TELEMETRY_DISABLED: "1" };
  delete environment.TURBO_API;
  delete environment.TURBO_REMOTE_CACHE_READ_ONLY;
  delete environment.TURBO_TEAM;
  delete environment.TURBO_TEAMID;
  delete environment.TURBO_TOKEN;

  execFileSync(
    TURBO_BINARY,
    [
      "run",
      "docs:build",
      "--filter=@croco/docs",
      "--cache=local:rw",
      `--cache-dir=${cacheDirectory}`,
      "--env-mode=strict",
      "--output-logs=errors-only",
      "--summarize",
    ],
    {
      cwd: REPOSITORY_ROOT,
      env: environment,
      stdio: "inherit",
      timeout: EXECUTION_TIMEOUT_MS,
    },
  );

  const directory = join(REPOSITORY_ROOT, ".turbo", "runs");
  const created = readdirSync(directory).filter((path) => !before.has(path));
  const summaries = created
    .map((path) => JSON.parse(readFileSync(join(directory, path), "utf8")) as TurboRunSummary)
    .filter(
      ({ execution }) =>
        execution?.command === "turbo run docs:build --filter=@croco/docs" &&
        typeof execution.startTime === "number" &&
        execution.startTime >= startedAt,
    );
  const [summary] = summaries;
  if (!summary || summaries.length !== 1) {
    throw new Error(
      `expected one matching Turbo run summary, found ${summaries.length} among ${created.length} new files`,
    );
  }
  return summary;
}

function assertCacheHit(summary: TurboRunSummary): void {
  const tasks = summary.tasks ?? [];
  const docsBuild = tasks.find(({ taskId }) => taskId === DOCS_BUILD_TASK);
  const models = tasks.filter(({ taskId }) => taskId?.endsWith("#docs:api:model"));
  const misses = tasks.filter(({ cache }) => cache?.status !== "HIT");

  if (docsBuild?.cache?.status !== "HIT") {
    throw new Error(`${DOCS_BUILD_TASK} was not restored from cache`);
  }
  if (models.length === 0) {
    throw new Error("Turbo run contained no package API documentation model tasks");
  }
  if (misses.length > 0) {
    throw new Error(
      `unchanged second docs build had cache misses: ${misses.map(({ taskId }) => taskId).join(", ")}`,
    );
  }
}

function removeTaskOutputs(): void {
  rmSync(DOCS_DIST, { force: true, recursive: true });
  for (const model of MODEL_OUTPUTS) rmSync(model, { force: true });
}

function assertTaskOutputsRestored(): void {
  if (!existsSync(DOCS_DIST)) throw new Error(`${DOCS_BUILD_TASK} restored no dist output`);
  const missingModels = MODEL_OUTPUTS.filter((model) => !existsSync(model));
  if (missingModels.length > 0) {
    throw new Error(`Turbo restored no model output for: ${missingModels.join(", ")}`);
  }
}

function main(): void {
  const trackedBefore = snapshotTracked();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-docs-cache-check-"));
  try {
    runDocsBuild(join(temporaryRoot, "cache"));
    removeTaskOutputs();
    const second = runDocsBuild(join(temporaryRoot, "cache"));
    assertCacheHit(second);
    assertTaskOutputsRestored();
    assertTrackedUnchanged(trackedBefore);
    const taskCount = second.tasks?.length ?? 0;
    const modelCount =
      second.tasks?.filter(({ taskId }) => taskId?.endsWith("#docs:api:model")).length ?? 0;
    stdout.write(
      `docs-cache-check: second build restored ${taskCount} tasks, including ${modelCount} package models, without tracked-file mutation.\n`,
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

main();
