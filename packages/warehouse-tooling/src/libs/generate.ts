import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { hostname } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";

const OWNERSHIP = ".croco-data-ownership.json";
type Ownership = { version: 1; files: Record<string, string> };
export class DataGenerationProblem extends Problem {
  readonly code = "warehouse-tooling/generation-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(
    readonly reason: string,
    readonly file?: string,
    readonly committedManifest?: unknown,
  ) {
    super(undefined, undefined, `Data generation ${reason}.`, {
      extensions: { reason, ...(file === undefined ? {} : { file }) },
    });
  }
}
function causedProblem(
  reason: string,
  file: string | undefined,
  manifest: unknown,
  cause: unknown,
): DataGenerationProblem {
  const problem = new DataGenerationProblem(reason, file, manifest);
  Object.defineProperty(problem, "cause", { value: cause, configurable: true });
  return problem;
}
const hash = (content: string) => createHash("sha256").update(content).digest("hex");
function safePath(file: string): void {
  if (
    !file ||
    isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some((part) => !part || part === "." || part === "..") ||
    file === OWNERSHIP
  )
    throw new DataGenerationProblem("invalid-owned-path");
}
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
async function rejectLinks(path: string): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
    throw new DataGenerationProblem("unsupported-file");
  if (stat.isDirectory())
    for (const name of await readdir(path)) await rejectLinks(join(path, name));
}
async function readOwnership(output: string): Promise<Ownership> {
  if (!(await exists(join(output, OWNERSHIP)))) return { version: 1, files: {} };
  let data: unknown;
  try {
    data = JSON.parse(await readFile(join(output, OWNERSHIP), "utf8"));
  } catch {
    throw new DataGenerationProblem("invalid-ownership");
  }
  const value = data as Ownership;
  if (
    value?.version !== 1 ||
    !value.files ||
    typeof value.files !== "object" ||
    Array.isArray(value.files)
  )
    throw new DataGenerationProblem("invalid-ownership");
  for (const [file, digest] of Object.entries(value.files)) {
    safePath(file);
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))
      throw new DataGenerationProblem("invalid-ownership");
    if (
      !(await exists(join(output, file))) ||
      hash(await readFile(join(output, file), "utf8")) !== digest
    )
      throw new DataGenerationProblem("modified-owned-file", file);
  }
  return value;
}

type GenerationLock = {
  token: string;
  pid: number;
  host: string;
  output: string;
  stage: string;
  backup: string;
};
async function recoverInterruptedGeneration(lock: string, output: string): Promise<never> {
  await rejectLinks(lock);
  let metadata: GenerationLock;
  try {
    metadata = JSON.parse(await readFile(join(lock, "owner.json"), "utf8")) as GenerationLock;
  } catch {
    throw new DataGenerationProblem("generation-recovery-required", lock);
  }
  if (
    !metadata ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(metadata.token) ||
    metadata.output !== output ||
    metadata.stage !== `${output}.stage-${metadata.token}` ||
    metadata.backup !== `${output}.backup-${metadata.token}` ||
    !Number.isSafeInteger(metadata.pid) ||
    metadata.pid < 1 ||
    metadata.host !== hostname()
  )
    throw new DataGenerationProblem("generation-recovery-required", lock);
  try {
    process.kill(metadata.pid, 0);
    throw new DataGenerationProblem("generation-in-progress", lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if ((await exists(output)) || !(await exists(metadata.backup)))
    throw new DataGenerationProblem("generation-recovery-required", metadata.backup);
  try {
    await mkdir(join(lock, "recovery"), { mode: 0o700 });
  } catch {
    throw new DataGenerationProblem("generation-recovery-required", metadata.backup);
  }
  try {
    await rejectLinks(metadata.backup);
    if (
      !(await lstat(metadata.backup)).isDirectory() ||
      !(await exists(join(metadata.backup, OWNERSHIP)))
    )
      throw new DataGenerationProblem("generation-recovery-required", metadata.backup);
    await readOwnership(metadata.backup);
    if (await exists(output))
      throw new DataGenerationProblem("generation-recovery-required", metadata.backup);
    await rename(metadata.backup, output);
    await rm(lock, { recursive: true });
  } catch (error) {
    throw causedProblem("generation-recovery-required", metadata.backup, undefined, error);
  }
  throw new DataGenerationProblem("interrupted-generation-restored", metadata.stage);
}

/** Commits a complete generated directory while retaining unowned files and immutable migrations. */
export async function generateDataArtifacts<T>(
  outputDirectory: string,
  compilation: { readonly manifest: T; readonly files: Readonly<Record<string, string>> },
  options: { readonly migrationId: string },
): Promise<T> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(options.migrationId))
    throw new DataGenerationProblem("invalid-migration-id");
  const requested = resolve(outputDirectory);
  const parent = dirname(requested);
  if (requested === parent) throw new DataGenerationProblem("invalid-output");
  await mkdir(parent, { recursive: true });
  const output = join(await realpath(parent), basename(requested));
  const lock = `${output}.croco-data-lock`;
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return recoverInterruptedGeneration(lock, output);
    throw error;
  }
  const token = randomUUID();
  const stage = `${output}.stage-${token}`;
  const backup = `${output}.backup-${token}`;
  let backedUp = false;
  let committed = false;
  let finalized!: T;
  let generationFailure: unknown;
  let generationFailed = false;
  const cleanupFailures: DataGenerationProblem[] = [];
  try {
    const metadata: GenerationLock = {
      token,
      pid: process.pid,
      host: hostname(),
      output,
      stage,
      backup,
    };
    await writeFile(join(lock, "owner.json"), JSON.stringify(metadata), {
      mode: 0o600,
      flag: "wx",
    });
    const present = await exists(output);
    if (present) {
      await rejectLinks(output);
      if (!(await lstat(output)).isDirectory()) throw new DataGenerationProblem("invalid-output");
    }
    const previous = present ? await readOwnership(output) : { version: 1 as const, files: {} };
    const files: Record<string, string> = {};
    for (const [file, content] of Object.entries(compilation.files)) {
      safePath(file);
      const path =
        file === "migrations/candidate.sql" ? `migrations/${options.migrationId}.sql` : file;
      if (typeof content !== "string" || Object.hasOwn(files, path))
        throw new DataGenerationProblem("invalid-artifact");
      files[path] = content;
    }
    const manifest = structuredClone(compilation.manifest) as {
      artifacts?: Record<string, string>;
    };
    if (manifest?.artifacts && Object.hasOwn(manifest.artifacts, "migrations/candidate.sql")) {
      const digest = manifest.artifacts["migrations/candidate.sql"];
      delete manifest.artifacts["migrations/candidate.sql"];
      manifest.artifacts[`migrations/${options.migrationId}.sql`] = digest;
    }
    files["manifest.json"] = `${JSON.stringify(
      manifest,
      (_key, value: unknown) => {
        if (value !== null && typeof value === "object" && !Array.isArray(value))
          return Object.fromEntries(
            Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          );
        return value;
      },
      2,
    )}\n`;
    for (const [file, content] of Object.entries(files)) {
      if (present && (await exists(join(output, file)))) {
        if (!Object.hasOwn(previous.files, file))
          throw new DataGenerationProblem("unowned-file-conflict", file);
        if (file.startsWith("migrations/") && previous.files[file] !== hash(content))
          throw new DataGenerationProblem("migration-id-conflict", file);
      }
    }
    await mkdir(stage, { mode: 0o700 });
    if (present) await cp(output, stage, { recursive: true, preserveTimestamps: true });
    const owned: Record<string, string> = {};
    for (const [file, digest] of Object.entries(previous.files)) {
      if (file.startsWith("migrations/") && !Object.hasOwn(files, file)) owned[file] = digest;
      else if (!Object.hasOwn(files, file)) await rm(join(stage, file));
    }
    for (const file of Object.keys(files).sort()) {
      await mkdir(dirname(join(stage, file)), { recursive: true });
      await writeFile(join(stage, file), files[file], { mode: 0o600 });
      owned[file] = hash(files[file]);
    }
    const ownership = {
      version: 1,
      files: Object.fromEntries(Object.entries(owned).sort(([a], [b]) => a.localeCompare(b))),
    };
    await writeFile(join(stage, OWNERSHIP), `${JSON.stringify(ownership, null, 2)}\n`, {
      mode: 0o600,
    });
    if (present) {
      await rename(output, backup);
      backedUp = true;
    }
    try {
      await rename(stage, output);
      committed = true;
    } catch (error) {
      if (backedUp) {
        try {
          await rename(backup, output);
          backedUp = false;
        } catch (rollbackError) {
          throw causedProblem(
            "generation-recovery-required",
            backup,
            undefined,
            new AggregateError([error, rollbackError], "Generation and rollback failures"),
          );
        }
      }
      throw error;
    }
    finalized = JSON.parse(files["manifest.json"]) as T;
  } catch (error) {
    generationFailed = true;
    generationFailure = error;
  } finally {
    try {
      if (!backedUp || committed) await rm(stage, { recursive: true, force: true });
      if (committed && backedUp) await rm(backup, { recursive: true });
    } catch (error) {
      cleanupFailures.push(
        causedProblem(
          committed ? "committed-cleanup-failed" : "staging-cleanup-failed",
          undefined,
          committed ? finalized : undefined,
          error,
        ),
      );
    }
    try {
      if (!backedUp || committed) await rm(lock, { recursive: true });
    } catch (error) {
      cleanupFailures.push(
        causedProblem(
          committed ? "committed-lock-cleanup-failed" : "lock-cleanup-failed",
          undefined,
          committed ? finalized : undefined,
          error,
        ),
      );
    }
  }
  if (cleanupFailures.length) {
    const first = cleanupFailures[0];
    throw causedProblem(
      first.reason,
      first.file,
      first.committedManifest,
      new AggregateError(
        [...(generationFailed ? [generationFailure] : []), ...cleanupFailures],
        "Generation and cleanup failures",
      ),
    );
  }
  if (generationFailed) throw generationFailure;
  return finalized;
}
