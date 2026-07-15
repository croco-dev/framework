import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export const TRACKED_FILE_MUTATION_EXIT_CODE = 86;

type WorktreeState =
  | { readonly kind: "file"; readonly content: Buffer; readonly mode: number }
  | { readonly kind: "symlink"; readonly target: string }
  | { readonly kind: "missing" }
  | { readonly kind: "other"; readonly mode: number };
type FileState = { readonly indexEntries: readonly string[]; readonly worktree: WorktreeState };
type Snapshot = {
  readonly files: ReadonlyMap<string, FileState>;
  readonly indexPath: string;
  readonly indexBytes: Buffer | undefined;
};
export type TrackedFileChange = {
  readonly kind: "added" | "deleted" | "rewritten" | "mode-changed";
  readonly path: string;
};

function git(root: string, args: readonly string[]): Buffer {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "buffer" });
  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString("utf8").trim()}`);
  return result.stdout;
}

export function snapshotTrackedFiles(root: string): Snapshot {
  const indexEntries = new Map<string, string[]>();
  for (const record of git(root, ["ls-files", "--stage", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)) {
    const separator = record.indexOf("\t");
    if (separator < 0) throw new Error(`unexpected git ls-files record: ${record}`);
    const path = record.slice(separator + 1);
    const entries = indexEntries.get(path) ?? [];
    entries.push(record.slice(0, separator));
    indexEntries.set(path, entries);
  }
  const files = new Map<string, FileState>();
  const paths = [...indexEntries.keys()];
  for (const path of paths) {
    try {
      const stat = lstatSync(resolve(root, path));
      const worktree: WorktreeState = stat.isFile()
        ? { kind: "file", content: readFileSync(resolve(root, path)), mode: stat.mode & 0o777 }
        : stat.isSymbolicLink()
          ? { kind: "symlink", target: readlinkSync(resolve(root, path)) }
          : { kind: "other", mode: stat.mode & 0o777 };
      files.set(path, { indexEntries: indexEntries.get(path) ?? [], worktree });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") throw error;
      files.set(path, {
        indexEntries: indexEntries.get(path) ?? [],
        worktree: { kind: "missing" },
      });
    }
  }
  const rawIndexPath = git(root, ["rev-parse", "--git-path", "index"]).toString("utf8").trim();
  const indexPath = resolve(root, rawIndexPath);
  return {
    files,
    indexPath,
    indexBytes: existsSync(indexPath) ? readFileSync(indexPath) : undefined,
  };
}

export function compareTrackedFiles(before: Snapshot, after: Snapshot): TrackedFileChange[] {
  const changes: TrackedFileChange[] = [];
  for (const path of [...new Set([...before.files.keys(), ...after.files.keys()])].sort()) {
    const previous = before.files.get(path);
    const current = after.files.get(path);
    if (!previous) changes.push({ kind: "added", path });
    else if (!current) changes.push({ kind: "deleted", path });
    else if (previous.worktree.kind !== "missing" && current.worktree.kind === "missing")
      changes.push({ kind: "deleted", path });
    else {
      if (
        !sameIndex(previous.indexEntries, current.indexEntries) ||
        !sameContent(previous.worktree, current.worktree)
      )
        changes.push({ kind: "rewritten", path });
      if (worktreeMode(previous.worktree) !== worktreeMode(current.worktree))
        changes.push({ kind: "mode-changed", path });
    }
  }
  return changes;
}

function sameIndex(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function sameContent(left: WorktreeState, right: WorktreeState): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "file" && right.kind === "file") return left.content.equals(right.content);
  if (left.kind === "symlink" && right.kind === "symlink") return left.target === right.target;
  return true;
}

function worktreeMode(state: WorktreeState): number | undefined {
  return state.kind === "file" || state.kind === "other" ? state.mode : undefined;
}

function removeWorktreePath(path: string): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return;
    throw error;
  }
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    rmSync(path, { force: true, recursive: true });
    return;
  }
  unlinkSync(path);
}

function restoreTrackedFiles(root: string, before: Snapshot, after: Snapshot): void {
  for (const path of [...new Set([...before.files.keys(), ...after.files.keys()])].sort()) {
    const absolutePath = resolve(root, path);
    const state = before.files.get(path)?.worktree;
    const current = after.files.get(path)?.worktree;
    if (!state) continue;
    if (
      state &&
      current &&
      sameContent(state, current) &&
      worktreeMode(state) === worktreeMode(current)
    )
      continue;
    if (state.kind === "missing") {
      removeWorktreePath(absolutePath);
      continue;
    }
    if (state.kind === "other") continue;
    removeWorktreePath(absolutePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (state.kind === "symlink") symlinkSync(state.target, absolutePath);
    else {
      writeFileSync(absolutePath, state.content);
      chmodSync(absolutePath, state.mode);
    }
  }
  restoreIndex(before);
}

function restoreIndex(before: Snapshot): void {
  if (before.indexBytes) writeFileSync(before.indexPath, before.indexBytes);
  else rmSync(before.indexPath, { force: true });
}

function parseArguments(args: readonly string[]) {
  const separator = args.indexOf("--");
  const recovery = args.indexOf("--recovery");
  if (separator < 0 || !args[separator + 1] || recovery < 0 || recovery + 1 >= separator) {
    throw new Error(
      "Usage: tracked-files:guard --recovery <write or fix command> -- <command> [arguments...]",
    );
  }
  return {
    command: args[separator + 1],
    commandArguments: args.slice(separator + 2),
    recovery: args[recovery + 1] ?? "",
  };
}

export function main(args = process.argv.slice(2), root = process.cwd()): number | NodeJS.Signals {
  let parsed: ReturnType<typeof parseArguments>;
  let before: Snapshot;
  try {
    parsed = parseArguments(args);
    before = snapshotTrackedFiles(root);
  } catch (error) {
    console.error(`tracked-files:guard: ${error instanceof Error ? error.message : String(error)}`);
    return TRACKED_FILE_MUTATION_EXIT_CODE;
  }
  const result = spawnSync(parsed.command, parsed.commandArguments, {
    cwd: root,
    stdio: "inherit",
  });
  let changes: TrackedFileChange[];
  try {
    changes = compareTrackedFiles(before, snapshotTrackedFiles(root));
  } catch (error) {
    console.error(
      `tracked-files:guard: final snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    try {
      restoreIndex(before);
      restoreTrackedFiles(root, before, snapshotTrackedFiles(root));
      console.error("tracked-files:guard: restored the tracked worktree and index baseline.");
    } catch (restoreError) {
      console.error(
        `tracked-files:guard: baseline restoration failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
      );
    }
    return TRACKED_FILE_MUTATION_EXIT_CODE;
  }
  if (changes.length > 0) {
    console.error("tracked-files:guard: the verification command mutated tracked files:");
    for (const change of changes) console.error(`- ${change.kind}: ${change.path}`);
    console.error(
      result.signal
        ? `wrapped command terminated by signal: ${result.signal}`
        : `wrapped command exit code: ${result.status ?? 1}`,
    );
    console.error(
      `Run the explicit writer or fix command, then commit the result: ${parsed.recovery}`,
    );
    try {
      restoreTrackedFiles(root, before, snapshotTrackedFiles(root));
      console.error("tracked-files:guard: restored the tracked worktree and index baseline.");
    } catch (error) {
      console.error(
        `tracked-files:guard: baseline restoration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return TRACKED_FILE_MUTATION_EXIT_CODE;
  }
  return result.signal ?? result.status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outcome = main();
  if (typeof outcome === "string") process.kill(process.pid, outcome);
  else process.exitCode = outcome;
}
