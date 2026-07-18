#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { argv, env, exit, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

type FileSnapshot = { readonly bytes: Buffer; readonly executable: boolean };
type TreeSnapshot = ReadonlyMap<string, FileSnapshot>;
type Drift = {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly deleted: readonly string[];
  readonly modeChanged: readonly string[];
};

const API_DOCS_PATH = join("packages", "docs", "src", "content", "docs", "api");
const SCRIPT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function parseRoot(args: readonly string[]): string {
  let root = SCRIPT_ROOT;
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--root") throw new Error(`Unknown option: ${args[index]}`);
    const value = args[index + 1];
    if (!value) throw new Error("--root requires a path");
    root = resolve(value);
    index++;
  }
  return root;
}

function trackedPaths(root: string): readonly string[] {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr.toString("utf8").trim()}`);
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function snapshotFile(path: string): FileSnapshot {
  const stat = lstatSync(path);
  if (!stat.isFile()) throw new Error(`path is not a regular file: ${path}`);
  return { bytes: readFileSync(path), executable: (stat.mode & 0o111) !== 0 };
}

function snapshotTracked(root: string): TreeSnapshot {
  const snapshot = new Map<string, FileSnapshot>();
  for (const path of trackedPaths(root)) {
    const absolutePath = join(root, path);
    if (existsSync(absolutePath)) snapshot.set(path, snapshotFile(absolutePath));
  }
  return snapshot;
}

function copyTrackedDocsSource(root: string, destination: string, snapshot: TreeSnapshot): void {
  const docsSourcePrefix = join("packages", "docs", "src") + sep;
  const contentConfigPath = join("packages", "docs", "src", "content.config.ts");
  const apiDocsPrefix = API_DOCS_PATH + sep;
  for (const [path, file] of snapshot) {
    if (path !== contentConfigPath && !path.startsWith(apiDocsPrefix)) continue;
    const target = join(destination, path.slice(docsSourcePrefix.length));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, path), target);
    chmodSync(target, file.executable ? 0o755 : 0o644);
  }
}

function verifyInstalledDependencies(root: string): void {
  if (!existsSync(join(root, "node_modules"))) {
    throw new Error(
      "installed dependency topology is missing root node_modules; run pnpm install before docs verification",
    );
  }
}

function runPnpm(root: string, args: readonly string[], environment: NodeJS.ProcessEnv): void {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function snapshotTree(root: string): TreeSnapshot {
  const snapshot = new Map<string, FileSnapshot>();
  if (!existsSync(root)) return snapshot;
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        snapshot.set(relative(root, path).split(sep).join("/"), snapshotFile(path));
      } else {
        throw new Error(`API docs contain unsupported path type: ${path}`);
      }
    }
  }
  visit(root);
  return snapshot;
}

function compareTrees(expected: TreeSnapshot, actual: TreeSnapshot): Drift {
  const expectedPaths = [...expected.keys()].sort();
  const actualPaths = [...actual.keys()].sort();
  const added = actualPaths.filter((path) => !expected.has(path));
  const deleted = expectedPaths.filter((path) => !actual.has(path));
  const changed: string[] = [];
  const modeChanged: string[] = [];
  for (const path of expectedPaths) {
    const before = expected.get(path);
    const after = actual.get(path);
    if (!before || !after) continue;
    if (!before.bytes.equals(after.bytes)) changed.push(path);
    if (before.executable !== after.executable) modeChanged.push(path);
  }
  return { added, changed, deleted, modeChanged };
}

function hasDrift(drift: Drift): boolean {
  return [drift.added, drift.changed, drift.deleted, drift.modeChanged].some(
    (paths) => paths.length > 0,
  );
}

function detail(label: string, paths: readonly string[]): string | undefined {
  return paths.length === 0 ? undefined : `${label}: ${paths.join(", ")}`;
}

function verifyPrimaryUnchanged(before: TreeSnapshot, after: TreeSnapshot): void {
  const drift = compareTrees(before, after);
  if (!hasDrift(drift)) return;
  const details = [
    detail("added", drift.added),
    detail("deleted", drift.deleted),
    detail("changed", drift.changed),
    detail("mode-changed", drift.modeChanged),
  ].filter((value): value is string => value !== undefined);
  throw new Error(`primary tracked workspace changed during verification: ${details.join("; ")}`);
}

function verify(root: string): Drift {
  verifyInstalledDependencies(root);
  const primaryBefore = snapshotTracked(root);
  const primaryDocs = snapshotTree(join(root, API_DOCS_PATH));
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-api-docs-check-"));
  const temporarySource = join(temporaryRoot, "src");
  const generatedDocsPath = join(temporarySource, "content", "docs", "api");
  const isolatedEnvironment = {
    ...env,
    CROCO_DOCS_BUILD_ROOT: temporaryRoot,
    TURBO_CACHE_DIR: join(temporaryRoot, "turbo-cache"),
  };
  try {
    copyTrackedDocsSource(root, temporarySource, primaryBefore);
    runPnpm(
      root,
      ["turbo", "run", "docs:build", "--force", "--env-mode=loose"],
      isolatedEnvironment,
    );
    const rawGeneratedDocs = snapshotTree(generatedDocsPath);
    const rawDrift = compareTrees(primaryDocs, rawGeneratedDocs);
    const generatedPathsToFormat = [...rawDrift.added, ...rawDrift.changed].map((path) =>
      join(generatedDocsPath, path),
    );
    if (generatedPathsToFormat.length > 0) {
      runPnpm(root, ["exec", "oxfmt", "--write", ...generatedPathsToFormat], isolatedEnvironment);
    }
    const generatedDocs = snapshotTree(generatedDocsPath);
    return compareTrees(primaryDocs, generatedDocs);
  } finally {
    try {
      verifyPrimaryUnchanged(primaryBefore, snapshotTracked(root));
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
  }
}

function main(): void {
  try {
    const drift = verify(parseRoot(argv.slice(2)));
    if (!hasDrift(drift)) {
      stdout.write("api-docs-drift-check: generated API docs match the tracked checkout.\n");
      return;
    }
    stdout.write("api-docs-drift-check: generated API docs drift detected.\n");
    for (const line of [
      detail("added", drift.added),
      detail("deleted", drift.deleted),
      detail("changed", drift.changed),
      detail("mode-changed", drift.modeChanged),
    ]) {
      if (line) stdout.write(`- ${line}\n`);
    }
    stdout.write("- generation: pnpm docs:build\n");
    stdout.write(`- formatting: pnpm exec oxfmt --write ${API_DOCS_PATH}\n`);
    stdout.write(
      "- recovery: regenerate and format the API docs, then commit the resulting files.\n",
    );
    exit(1);
  } catch (error) {
    stdout.write(
      `api-docs-drift-check: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) main();
