import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  createReusableReceipt,
  evidenceDigest,
  parseProducerBundle,
  parseReusableReceipt,
} from "./ci-lane-evidence.mts";
import { VerificationProblem } from "./verification-problem.mts";
import type {
  CacheOrigin,
  EvidenceIdentity,
  ExperimentIdentity,
  ProducerBundle,
  ProducerLane,
  ReusableReceipt,
} from "./ci-lane-evidence.mts";

export const EXACT_LANE_CACHE_SCHEMA = "croco.ci-exact-lane-cache/v1" as const;

export type LaneCacheCommandBinding = {
  readonly checkId: string;
  readonly commandDigest: string;
  readonly taskHash: string;
};

export type LaneCacheMaterialization = {
  readonly sourcePath: string;
  readonly copiedPath: string;
  readonly directory: boolean;
};

export type ExactLaneCacheContext = {
  readonly identity: ExperimentIdentity;
  readonly lane: ProducerLane;
  readonly baseSha: string;
  readonly changedFilesDigest: string;
  readonly outputDir: string;
  readonly commandBindings: readonly LaneCacheCommandBinding[];
};

type ExactLaneCacheEntry = {
  readonly schemaVersion: typeof EXACT_LANE_CACHE_SCHEMA;
  readonly sourceRun: {
    readonly runId: string;
    readonly runAttempt: number;
    readonly verificationExperimentId: string;
  };
  readonly stableIdentity: Omit<
    ExperimentIdentity,
    "runId" | "runAttempt" | "verificationExperimentId"
  >;
  readonly lane: ProducerLane;
  readonly baseSha: string;
  readonly changedFilesDigest: string;
  readonly outputDir: string;
  readonly commandBindings: readonly LaneCacheCommandBinding[];
  readonly materializations: readonly LaneCacheMaterialization[];
  readonly bundle: ProducerBundle;
  readonly entryDigest: string;
};

export type ExactLaneCacheHit = {
  readonly bundle: ProducerBundle;
  readonly receipts: ReadonlyMap<string, ReusableReceipt>;
};

function fail(code: string, message: string): never {
  throw new VerificationProblem(code, "contract", message);
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail("INVALID_EXACT_CACHE_SCHEMA", `${path} contains an unexpected field set.`);
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INVALID_EXACT_CACHE_SCHEMA", `${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("INVALID_EXACT_CACHE_SCHEMA", `${path} must be a non-empty string.`);
  }
  return value;
}

function digest(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!/^[a-f0-9]{64}$/.test(parsed)) fail("INVALID_EXACT_CACHE_DIGEST", `${path} is invalid.`);
  return parsed;
}

function commitSha(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!/^[a-f0-9]{40}$/.test(parsed)) fail("INVALID_EXACT_CACHE_COMMIT", `${path} is invalid.`);
  return parsed;
}

function normalizedRepositoryPath(value: unknown, path: string): string {
  const parsed = string(value, path).replaceAll("\\", "/");
  if (
    isAbsolute(parsed) ||
    /^[A-Za-z]:\//.test(parsed) ||
    parsed.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    fail("UNSAFE_EXACT_CACHE_PATH", `${path} must be repository-relative and normalized.`);
  }
  return parsed;
}

function assertUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) fail(code, `${code} contains duplicate values.`);
}

function stableIdentity(
  identity: ExperimentIdentity | EvidenceIdentity,
): ExactLaneCacheEntry["stableIdentity"] {
  return {
    architectureVersion: identity.architectureVersion,
    commitSha: identity.commitSha,
    profile: identity.profile,
    manifestDigest: identity.manifestDigest,
    inventoryDigest: identity.inventoryDigest,
    toolchainDigest: identity.toolchainDigest,
    inputDigest: identity.inputDigest,
  };
}

function contextBindings(context: ExactLaneCacheContext): readonly LaneCacheCommandBinding[] {
  const bindings = [...context.commandBindings].sort((left, right) =>
    left.checkId.localeCompare(right.checkId),
  );
  assertUnique(
    bindings.map(({ checkId }) => checkId),
    "DUPLICATE_EXACT_CACHE_BINDING",
  );
  for (const binding of bindings) {
    digest(binding.commandDigest, `binding.${binding.checkId}.commandDigest`);
    digest(binding.taskHash, `binding.${binding.checkId}.taskHash`);
  }
  return bindings;
}

function withoutEntryDigest(entry: ExactLaneCacheEntry): Omit<ExactLaneCacheEntry, "entryDigest"> {
  const { entryDigest: _digest, ...unsigned } = entry;
  return unsigned;
}

function assertDescendant(parent: string, candidate: string, code: string): void {
  const descendant = relative(resolve(parent), resolve(candidate)).replaceAll("\\", "/");
  if (descendant === "" || descendant.startsWith("../") || isAbsolute(descendant)) {
    fail(code, `${candidate} must be a descendant of ${parent}.`);
  }
}

function cacheFile(cacheDir: string, repositoryPath: string): string {
  const destination = resolve(cacheDir, "files", repositoryPath);
  assertDescendant(join(cacheDir, "files"), destination, "EXACT_CACHE_FILE_ESCAPE");
  return destination;
}

function readEntry(cacheDir: string): unknown | null {
  if (!existsSync(cacheDir)) return null;
  const entryPath = join(cacheDir, "entry.json");
  if (!existsSync(entryPath)) {
    if (readdirSync(cacheDir).length === 0) return null;
    fail("INCOMPLETE_EXACT_CACHE", "Exact cache directory contains files without entry.json.");
  }
  try {
    return JSON.parse(readFileSync(entryPath, "utf8")) as unknown;
  } catch (error) {
    fail(
      "INVALID_EXACT_CACHE_ENTRY",
      `Unable to parse exact cache entry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readCheckRecord(cacheDir: string, recordPath: string): Record<string, unknown> {
  try {
    return record(JSON.parse(readFileSync(cacheFile(cacheDir, recordPath), "utf8")), recordPath);
  } catch (error) {
    if (error instanceof VerificationProblem) throw error;
    fail(
      "INVALID_EXACT_CACHE_RECORD",
      `Unable to parse ${recordPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseMaterialization(value: unknown, index: number): LaneCacheMaterialization {
  const parsed = record(value, `materializations[${index}]`);
  exactKeys(parsed, ["sourcePath", "copiedPath", "directory"], `materializations[${index}]`);
  if (typeof parsed.directory !== "boolean") {
    fail("INVALID_EXACT_CACHE_SCHEMA", `materializations[${index}].directory must be boolean.`);
  }
  return {
    sourcePath: normalizedRepositoryPath(
      parsed.sourcePath,
      `materializations[${index}].sourcePath`,
    ),
    copiedPath: normalizedRepositoryPath(
      parsed.copiedPath,
      `materializations[${index}].copiedPath`,
    ),
    directory: parsed.directory,
  };
}

function parseBinding(value: unknown, index: number): LaneCacheCommandBinding {
  const parsed = record(value, `commandBindings[${index}]`);
  exactKeys(parsed, ["checkId", "commandDigest", "taskHash"], `commandBindings[${index}]`);
  return {
    checkId: string(parsed.checkId, `commandBindings[${index}].checkId`),
    commandDigest: digest(parsed.commandDigest, `commandBindings[${index}].commandDigest`),
    taskHash: digest(parsed.taskHash, `commandBindings[${index}].taskHash`),
  };
}

function parseEntry(value: unknown): ExactLaneCacheEntry {
  const parsed = record(value, "cache");
  exactKeys(
    parsed,
    [
      "schemaVersion",
      "sourceRun",
      "stableIdentity",
      "lane",
      "baseSha",
      "changedFilesDigest",
      "outputDir",
      "commandBindings",
      "materializations",
      "bundle",
      "entryDigest",
    ],
    "cache",
  );
  if (parsed.schemaVersion !== EXACT_LANE_CACHE_SCHEMA) {
    fail(
      "INVALID_EXACT_CACHE_SCHEMA",
      `cache.schemaVersion must equal ${EXACT_LANE_CACHE_SCHEMA}.`,
    );
  }
  const bundle = parseProducerBundle(parsed.bundle, "cache.bundle");
  const sourceRun = record(parsed.sourceRun, "cache.sourceRun");
  exactKeys(sourceRun, ["runId", "runAttempt", "verificationExperimentId"], "cache.sourceRun");
  if (!Number.isSafeInteger(sourceRun.runAttempt) || (sourceRun.runAttempt as number) <= 0) {
    fail("INVALID_EXACT_CACHE_SCHEMA", "cache.sourceRun.runAttempt must be positive.");
  }
  const stable = record(parsed.stableIdentity, "cache.stableIdentity");
  const expectedStableKeys = Object.keys(stableIdentity(bundle));
  exactKeys(stable, expectedStableKeys, "cache.stableIdentity");
  const commandBindings = Array.isArray(parsed.commandBindings)
    ? parsed.commandBindings.map(parseBinding)
    : fail("INVALID_EXACT_CACHE_SCHEMA", "cache.commandBindings must be an array.");
  const materializations = Array.isArray(parsed.materializations)
    ? parsed.materializations.map(parseMaterialization)
    : fail("INVALID_EXACT_CACHE_SCHEMA", "cache.materializations must be an array.");
  const entry: ExactLaneCacheEntry = {
    schemaVersion: EXACT_LANE_CACHE_SCHEMA,
    sourceRun: {
      runId: string(sourceRun.runId, "cache.sourceRun.runId"),
      runAttempt: sourceRun.runAttempt as number,
      verificationExperimentId: string(
        sourceRun.verificationExperimentId,
        "cache.sourceRun.verificationExperimentId",
      ),
    },
    stableIdentity: stable as ExactLaneCacheEntry["stableIdentity"],
    lane: bundle.lane,
    baseSha: commitSha(parsed.baseSha, "cache.baseSha"),
    changedFilesDigest: digest(parsed.changedFilesDigest, "cache.changedFilesDigest"),
    outputDir: normalizedRepositoryPath(parsed.outputDir, "cache.outputDir"),
    commandBindings,
    materializations,
    bundle,
    entryDigest: digest(parsed.entryDigest, "cache.entryDigest"),
  };
  if (entry.entryDigest !== evidenceDigest(withoutEntryDigest(entry))) {
    fail(
      "EXACT_CACHE_ENTRY_DIGEST_MISMATCH",
      "Exact cache entry digest does not bind its payload.",
    );
  }
  assertUnique(
    commandBindings.map(({ checkId }) => checkId),
    "DUPLICATE_EXACT_CACHE_BINDING",
  );
  assertUnique(
    materializations.map(({ sourcePath }) => sourcePath),
    "DUPLICATE_EXACT_CACHE_MATERIALIZATION",
  );
  return entry;
}

function assertContext(entry: ExactLaneCacheEntry, context: ExactLaneCacheContext): void {
  const expected = {
    stableIdentity: stableIdentity(context.identity),
    lane: context.lane,
    baseSha: context.baseSha,
    changedFilesDigest: context.changedFilesDigest,
    outputDir: context.outputDir,
    commandBindings: contextBindings(context),
  };
  const actual = {
    stableIdentity: entry.stableIdentity,
    lane: entry.lane,
    baseSha: entry.baseSha,
    changedFilesDigest: entry.changedFilesDigest,
    outputDir: entry.outputDir,
    commandBindings: entry.commandBindings,
  };
  if (evidenceDigest(actual) !== evidenceDigest(expected)) {
    fail(
      "STALE_EXACT_CACHE_IDENTITY",
      "Exact cache candidate does not match current identity and inputs.",
    );
  }
}

function assertBundleContract(entry: ExactLaneCacheEntry, context: ExactLaneCacheContext): void {
  if (
    entry.bundle.status !== "success" ||
    entry.bundle.checks.some(({ outcome }) => outcome === "failed")
  ) {
    fail("FAILED_EXACT_CACHE_CANDIDATE", "Only fully successful producer bundles are reusable.");
  }
  const bindingById = new Map(entry.commandBindings.map((binding) => [binding.checkId, binding]));
  const receiptById = new Map(entry.bundle.receipts.map((receipt) => [receipt.checkId, receipt]));
  for (const check of entry.bundle.checks) {
    const binding = bindingById.get(check.id);
    if (!binding) fail("MISSING_EXACT_CACHE_BINDING", `Missing command binding for ${check.id}.`);
    if (check.selection === "not-applicable") {
      if (receiptById.has(check.id))
        fail("NA_EXACT_CACHE_RECEIPT", `${check.id} must not have a receipt.`);
      continue;
    }
    const receipt = receiptById.get(check.id);
    if (!receipt) fail("MISSING_EXACT_CACHE_RECEIPT", `Missing receipt for ${check.id}.`);
    if (
      receipt.cache.origin !== "executed" ||
      receipt.commandDigest !== binding.commandDigest ||
      receipt.taskHash !== binding.taskHash
    ) {
      fail(
        "EXACT_CACHE_TASK_MISMATCH",
        `Receipt for ${check.id} is not an exact executed task match.`,
      );
    }
    for (const field of [
      "profile",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
    ] as const) {
      if (receipt[field] !== context.identity[field]) {
        fail("EXACT_CACHE_RECEIPT_IDENTITY_MISMATCH", `Receipt ${check.id} mismatches ${field}.`);
      }
    }
  }
}

function validateCachedFiles(cacheDir: string, entry: ExactLaneCacheEntry): void {
  const artifactByPath = new Map(
    entry.bundle.artifact.files.map((output) => [output.path, output]),
  );
  for (const output of entry.bundle.artifact.files) {
    if (!output.path.startsWith(`${entry.outputDir}/`)) {
      fail(
        "EXACT_CACHE_OUTPUT_SCOPE_MISMATCH",
        `Cached output escapes lane output: ${output.path}.`,
      );
    }
    const path = cacheFile(cacheDir, output.path);
    let metadata;
    try {
      metadata = lstatSync(path);
    } catch {
      fail("MISSING_EXACT_CACHE_OUTPUT", `Cached output is missing: ${output.path}.`);
    }
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      fail("INVALID_EXACT_CACHE_OUTPUT", `Cached output is not a regular file: ${output.path}.`);
    }
    const contents = readFileSync(path);
    if (contents.byteLength !== output.bytes || sha256(contents) !== output.digest) {
      fail("CORRUPT_EXACT_CACHE_OUTPUT", `Cached output bytes do not match ${output.path}.`);
    }
  }
  const filesRoot = join(cacheDir, "files");
  const visitFiles = (directory: string): readonly string[] =>
    readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          fail("SYMLINK_EXACT_CACHE_OUTPUT", `Exact cache contains a symbolic link: ${path}.`);
        }
        if (entry.isDirectory()) return visitFiles(path);
        if (!entry.isFile()) fail("INVALID_EXACT_CACHE_OUTPUT", `Exact cache contains ${path}.`);
        return [relative(filesRoot, path).replaceAll("\\", "/")];
      });
  const actualPaths = [...visitFiles(filesRoot)].sort((left, right) => left.localeCompare(right));
  const expectedPaths = entry.bundle.artifact.files
    .map(({ path }) => path)
    .sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    fail("EXACT_CACHE_PATH_SET_MISMATCH", "Exact cache file path set does not match the bundle.");
  }
  const bindingById = new Map(entry.commandBindings.map((binding) => [binding.checkId, binding]));
  const checkRecords = new Map<string, Record<string, unknown>>();
  for (const check of entry.bundle.checks) {
    const recordPath = `${entry.outputDir}/checks/${check.id}.json`;
    if (!artifactByPath.has(recordPath)) {
      fail("MISSING_EXACT_CACHE_RECORD", `Bundle lacks normalized record ${recordPath}.`);
    }
    const checkRecord = readCheckRecord(cacheDir, recordPath);
    checkRecords.set(check.id, checkRecord);
    exactKeys(
      checkRecord,
      [
        "schemaVersion",
        "identity",
        "checkId",
        "selection",
        "semantics",
        "outcome",
        "commandDigest",
        "execution",
        "diagnostics",
      ],
      recordPath,
    );
    const binding = bindingById.get(check.id);
    const recordIdentity = record(checkRecord.identity, `${recordPath}.identity`);
    if (
      !binding ||
      checkRecord.schemaVersion !== "croco.ci-cacheable-lane-check/v1" ||
      checkRecord.checkId !== check.id ||
      checkRecord.selection !== check.selection ||
      checkRecord.outcome !== check.outcome ||
      checkRecord.commandDigest !== binding.commandDigest ||
      recordIdentity.lane !== entry.lane ||
      evidenceDigest(stableIdentity(recordIdentity as EvidenceIdentity)) !==
        evidenceDigest(entry.stableIdentity)
    ) {
      fail("INVALID_EXACT_CACHE_RECORD", `Normalized record is not bound to ${check.id}.`);
    }
  }
  for (const receipt of entry.bundle.receipts) {
    parseReusableReceipt(receipt, `cache.receipt.${receipt.checkId}`);
    for (const output of receipt.outputs) {
      const artifact = artifactByPath.get(output.path);
      if (!artifact || evidenceDigest(artifact) !== evidenceDigest(output)) {
        fail("UNBOUND_EXACT_CACHE_OUTPUT", `Receipt output is absent from bundle: ${output.path}.`);
      }
    }
    const recordPath = `${entry.outputDir}/checks/${receipt.checkId}.json`;
    const recordOutput = receipt.outputs.find(({ path }) => path === recordPath);
    if (!recordOutput) fail("MISSING_EXACT_CACHE_RECORD", `Receipt lacks ${recordPath}.`);
    const checkRecord = checkRecords.get(receipt.checkId);
    if (!checkRecord) fail("MISSING_EXACT_CACHE_RECORD", `Receipt lacks parsed ${recordPath}.`);
    if (
      checkRecord.schemaVersion !== "croco.ci-cacheable-lane-check/v1" ||
      checkRecord.checkId !== receipt.checkId ||
      checkRecord.selection !== "selected" ||
      checkRecord.outcome !== "passed" ||
      checkRecord.commandDigest !== receipt.commandDigest ||
      evidenceDigest(checkRecord) !== receipt.contentHash
    ) {
      fail("INVALID_EXACT_CACHE_RECORD", `Normalized record is not bound to ${receipt.checkId}.`);
    }
  }
}

function restoreFiles(rootDir: string, cacheDir: string, entry: ExactLaneCacheEntry): void {
  for (const output of entry.bundle.artifact.files) {
    const destination = resolve(rootDir, output.path);
    assertDescendant(rootDir, destination, "EXACT_CACHE_RESTORE_ESCAPE");
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(cacheFile(cacheDir, output.path), destination);
  }
  const outputPaths = entry.bundle.artifact.files.map(({ path }) => path);
  for (const materialization of entry.materializations) {
    const destination = resolve(rootDir, materialization.sourcePath);
    assertDescendant(rootDir, destination, "EXACT_CACHE_MATERIALIZATION_ESCAPE");
    if (materialization.directory) {
      const prefix = `${materialization.copiedPath}/`;
      const files = outputPaths.filter((path) => path.startsWith(prefix));
      if (files.length === 0) {
        fail(
          "EMPTY_EXACT_CACHE_MATERIALIZATION",
          `No cached files back ${materialization.sourcePath}.`,
        );
      }
      for (const cachedPath of files) {
        const target = join(destination, cachedPath.slice(prefix.length));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(resolve(rootDir, cachedPath), target);
      }
    } else {
      if (!outputPaths.includes(materialization.copiedPath)) {
        fail("MISSING_EXACT_CACHE_MATERIALIZATION", `${materialization.copiedPath} is not cached.`);
      }
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(rootDir, materialization.copiedPath), destination);
    }
  }
}

export function restoreExactLaneCache(options: {
  readonly rootDir: string;
  readonly cacheDir: string;
  readonly origin?: CacheOrigin;
  readonly context: ExactLaneCacheContext;
}): ExactLaneCacheHit | null {
  const value = readEntry(options.cacheDir);
  if (value === null) return null;
  if (options.origin !== "github-exact-key") {
    const code = options.origin === "fork" ? "UNTRUSTED_FORK_CACHE" : "UNTRUSTED_RESTORE_PREFIX";
    fail(code, "Only a GitHub exact-key cache candidate may be restored.");
  }
  if (options.context.lane === "coverage-security") {
    fail("SECURITY_CACHE_REUSE_FORBIDDEN", "Coverage/security physical results cannot be reused.");
  }
  const entry = parseEntry(value);
  assertContext(entry, options.context);
  assertBundleContract(entry, options.context);
  validateCachedFiles(options.cacheDir, entry);
  restoreFiles(options.rootDir, options.cacheDir, entry);
  const receipts = new Map(
    entry.bundle.receipts.map((receipt) => {
      const { schemaVersion: _schema, receiptDigest: _digest, ...unsigned } = receipt;
      return [
        receipt.checkId,
        createReusableReceipt({
          ...unsigned,
          cache: { origin: "github-exact-key", revalidated: true, policyDigest: null },
        }),
      ];
    }),
  );
  return { bundle: entry.bundle, receipts };
}

export function writeExactLaneCache(options: {
  readonly rootDir: string;
  readonly cacheDir: string;
  readonly context: ExactLaneCacheContext;
  readonly bundle: ProducerBundle;
  readonly materializations: readonly LaneCacheMaterialization[];
}): void {
  if (options.context.lane === "coverage-security") return;
  if (
    options.bundle.status !== "success" ||
    options.bundle.checks.some(({ outcome }) => outcome === "failed")
  ) {
    return;
  }
  const entryPath = join(options.cacheDir, "entry.json");
  if (
    existsSync(entryPath) ||
    (existsSync(options.cacheDir) && readdirSync(options.cacheDir).length > 0)
  ) {
    fail("EXACT_CACHE_ALREADY_EXISTS", "Refusing to overwrite an existing exact cache candidate.");
  }
  const materializations = options.materializations.map((materialization, index) =>
    parseMaterialization(materialization, index),
  );
  assertUnique(
    materializations.map(({ sourcePath }) => sourcePath),
    "DUPLICATE_EXACT_CACHE_MATERIALIZATION",
  );
  for (const output of options.bundle.artifact.files) {
    const source = resolve(options.rootDir, output.path);
    assertDescendant(options.rootDir, source, "EXACT_CACHE_SOURCE_ESCAPE");
    const contents = readFileSync(source);
    if (contents.byteLength !== output.bytes || sha256(contents) !== output.digest) {
      fail("EXACT_CACHE_SOURCE_CHANGED", `Output changed before cache snapshot: ${output.path}.`);
    }
    const destination = cacheFile(options.cacheDir, output.path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  const unsigned = {
    schemaVersion: EXACT_LANE_CACHE_SCHEMA,
    sourceRun: {
      runId: options.context.identity.runId,
      runAttempt: options.context.identity.runAttempt,
      verificationExperimentId: options.context.identity.verificationExperimentId,
    },
    stableIdentity: stableIdentity(options.context.identity),
    lane: options.context.lane,
    baseSha: options.context.baseSha,
    changedFilesDigest: options.context.changedFilesDigest,
    outputDir: options.context.outputDir,
    commandBindings: contextBindings(options.context),
    materializations,
    bundle: options.bundle,
  } as const;
  const entry = { ...unsigned, entryDigest: evidenceDigest(unsigned) };
  mkdirSync(options.cacheDir, { recursive: true });
  const temporaryPath = `${entryPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(entry, null, 2)}\n`);
  renameSync(temporaryPath, entryPath);
}
