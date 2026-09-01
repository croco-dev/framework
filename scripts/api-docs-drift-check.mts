#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { argv, env, exit, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

type FileSnapshot = { readonly bytes: Buffer; readonly executable: boolean };
type TreeSnapshot = ReadonlyMap<string, FileSnapshot>;
type Mode = "check" | "write";
type Options = { readonly mode: Mode; readonly root: string };
type ReplaceApiDocsOperations = { readonly rename: typeof renameSync };
type Drift = {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly deleted: readonly string[];
  readonly modeChanged: readonly string[];
};

const API_DOCS_PATH = "packages/docs/src/content/docs/api";
const CACHED_API_DOCS_PATH = "packages/docs/.turbo/docs-api/rendered";
const SCRIPT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function parseOptions(args: readonly string[]): Options {
  let root = SCRIPT_ROOT;
  let mode: Mode = "check";
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--check") {
      mode = "check";
      continue;
    }
    if (args[index] === "--write") {
      mode = "write";
      continue;
    }
    if (args[index] !== "--root") throw new Error(`Unknown option: ${args[index]}`);
    const value = args[index + 1];
    if (!value) throw new Error("--root requires a path");
    root = resolve(value);
    index++;
  }
  return { mode, root };
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

export function snapshotTree(root: string): TreeSnapshot {
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

function withoutApiDocs(snapshot: TreeSnapshot): TreeSnapshot {
  const prefix = `${API_DOCS_PATH}/`;
  return new Map([...snapshot].filter(([path]) => !path.startsWith(prefix)));
}

function verifyPrimaryUnchanged(before: TreeSnapshot, after: TreeSnapshot, mode: Mode): void {
  const expected = mode === "write" ? withoutApiDocs(before) : before;
  const actual = mode === "write" ? withoutApiDocs(after) : after;
  const drift = compareTrees(expected, actual);
  if (!hasDrift(drift)) return;
  const details = [
    detail("added", drift.added),
    detail("deleted", drift.deleted),
    detail("changed", drift.changed),
    detail("mode-changed", drift.modeChanged),
  ].filter((value): value is string => value !== undefined);
  throw new Error(`primary tracked workspace changed during verification: ${details.join("; ")}`);
}

export function replaceApiDocs(
  root: string,
  generatedDocsPath: string,
  generatedDocs: TreeSnapshot,
  operations: ReplaceApiDocsOperations = { rename: renameSync },
): void {
  const target = join(root, API_DOCS_PATH);
  const staged = `${target}.next-${process.pid}`;
  const previous = `${target}.previous-${process.pid}`;
  let movedPrevious = false;
  let installed = false;
  rmSync(staged, { force: true, recursive: true });
  rmSync(previous, { force: true, recursive: true });
  try {
    mkdirSync(dirname(staged), { recursive: true });
    cpSync(generatedDocsPath, staged, { recursive: true });
    const stagedDrift = compareTrees(generatedDocs, snapshotTree(staged));
    if (hasDrift(stagedDrift)) {
      throw new Error("staged API docs do not match the generated candidate");
    }

    operations.rename(target, previous);
    movedPrevious = true;
    operations.rename(staged, target);
    installed = true;

    const writtenDrift = compareTrees(generatedDocs, snapshotTree(target));
    if (hasDrift(writtenDrift)) {
      throw new Error("written API docs do not match the generated candidate");
    }
    rmSync(previous, { force: true, recursive: true });
    movedPrevious = false;
  } catch (error) {
    if (movedPrevious && existsSync(previous)) {
      if (installed) rmSync(target, { force: true, recursive: true });
      operations.rename(previous, target);
      movedPrevious = false;
    }
    throw error;
  } finally {
    rmSync(staged, { force: true, recursive: true });
    if (!movedPrevious) rmSync(previous, { force: true, recursive: true });
  }
}

function verify(root: string, mode: Mode): Drift {
  verifyInstalledDependencies(root);
  const primaryBefore = snapshotTracked(root);
  const primaryDocs = snapshotTree(join(root, API_DOCS_PATH));
  const generatedDocsPath = join(root, CACHED_API_DOCS_PATH);
  try {
    rmSync(generatedDocsPath, { force: true, recursive: true });
    runPnpm(
      root,
      [
        "turbo",
        "run",
        "docs:api:render",
        "--filter=@croco/docs",
        "--env-mode=loose",
        "--output-logs=errors-only",
      ],
      env,
    );
    const generatedDocs = snapshotTree(generatedDocsPath);
    if (generatedDocs.size === 0) throw new Error("Turbo restored no generated API docs");
    const drift = compareTrees(primaryDocs, generatedDocs);
    if (mode === "write" && hasDrift(drift)) replaceApiDocs(root, generatedDocsPath, generatedDocs);
    return drift;
  } finally {
    verifyPrimaryUnchanged(primaryBefore, snapshotTracked(root), mode);
  }
}

function main(): void {
  try {
    const options = parseOptions(argv.slice(2));
    const drift = verify(options.root, options.mode);
    if (options.mode === "write") {
      stdout.write(
        hasDrift(drift)
          ? "api-docs-drift-check: wrote generated API docs to the tracked checkout.\n"
          : "api-docs-drift-check: tracked API docs were already current.\n",
      );
      return;
    }
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
    stdout.write("- recovery: pnpm docs:api:write, then commit the resulting files.\n");
    exit(1);
  } catch (error) {
    stdout.write(
      `api-docs-drift-check: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) main();
