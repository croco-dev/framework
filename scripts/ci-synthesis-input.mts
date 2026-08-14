#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  cacheableInputDigest,
  changedFilesDigest,
  digestFile,
  readChangedFiles,
  resolveCommitSha,
} from "./ci-cacheable-experiment-identity.mts";
import {
  evidenceDigest,
  parseExperimentIdentity,
  parseProducerBundle,
  PRODUCER_LANES,
} from "./ci-lane-evidence.mts";
import { SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { assertLaneReport } from "./test-evidence-reconcile.mts";
import {
  parseMaterializationEvidence,
  parseStrictTestInventory,
  validateRepositoryPath,
} from "./test-inventory.mts";
import { VerificationProblem } from "./verification-problem.mts";
import {
  createVerificationManifest,
  VERIFICATION_LANE_OWNERSHIP,
} from "./verification-manifest.mts";
import type {
  ExperimentIdentity,
  ProducerBundle,
  ProducerLane,
  SynthesisSecurityResult,
} from "./ci-lane-evidence.mts";
import type {
  BundleSizeWarningReport,
  PackageQualityRow,
  PublicApiGuardResult,
} from "./package-quality-report.mts";
import type { LaneReport } from "./test-evidence-reconcile.mts";
import { inventoryDigest } from "./test-inventory.mts";
import type { MaterializationEvidence, TestInventory } from "./test-inventory.mts";

export const SYNTHESIS_INPUT_SCHEMA = "croco.ci-synthesis-input/v1" as const;
export const PRODUCER_FACTS_SCHEMA = "croco.ci-producer-facts/v1" as const;
export const PRODUCER_FACTS_FILE = "producer-facts.json" as const;

const SYNTHESIS_CHECK_IDS = [
  "test-evidence-reconcile",
  "production-ready",
  "spine-promotion",
  "spine-bundle-size",
] as const;

type SynthesisCheckId = (typeof SYNTHESIS_CHECK_IDS)[number];

export type CoreVerificationFacts = {
  readonly schemaVersion: typeof PRODUCER_FACTS_SCHEMA;
  readonly lane: "core-verification";
  readonly inventory: TestInventory;
  readonly fastLane: LaneReport | null;
  readonly integrationLane: LaneReport | null;
  readonly packageTasks: readonly PackageQualityRow[];
  readonly bundleSize: BundleSizeWarningReport;
  readonly productionReadyRequireTaskSummaries: boolean;
};

export type GeneratedAppsFacts = {
  readonly schemaVersion: typeof PRODUCER_FACTS_SCHEMA;
  readonly lane: "generated-apps";
  readonly requiredSourcePaths: readonly string[];
  readonly executedSourcePaths: readonly string[];
  readonly materializations: readonly MaterializationEvidence[];
  readonly promotionArtifacts: readonly PromotionArtifactFact[];
};

export type PromotionArtifactFact = {
  readonly commandId: string;
  readonly path: string;
  readonly digest: string;
  readonly semanticStatus: "passed" | "failed" | "unknown";
};

export type PackageArtifactsFacts = {
  readonly schemaVersion: typeof PRODUCER_FACTS_SCHEMA;
  readonly lane: "package-artifacts";
  readonly publishedLane: LaneReport | null;
  readonly publicApi: PublicApiGuardResult;
  readonly promotionArtifacts: readonly PromotionArtifactFact[];
};

export type CoverageSecurityFacts = {
  readonly schemaVersion: typeof PRODUCER_FACTS_SCHEMA;
  readonly lane: "coverage-security";
  readonly securityPhysical: readonly SynthesisSecurityResult[];
};

export type ProducerFacts =
  | CoreVerificationFacts
  | GeneratedAppsFacts
  | PackageArtifactsFacts
  | CoverageSecurityFacts;

export type SynthesisSelection = {
  readonly baseSha: string;
  readonly headSha: string;
  readonly changedFilesDigest: string;
  readonly inventoryFileDigest: string;
  readonly selectedCheckIds: readonly string[];
};

export type SynthesisInput = {
  readonly schemaVersion: typeof SYNTHESIS_INPUT_SCHEMA;
  readonly identity: ExperimentIdentity;
  readonly selection: SynthesisSelection;
  readonly producers: readonly {
    readonly lane: ProducerLane;
    readonly artifactName: string;
    readonly bundleDigest: string;
    readonly outputDigest: string;
    readonly status: "success" | "failure";
  }[];
  readonly producerResults: readonly {
    readonly id: string;
    readonly lane: ProducerLane;
    readonly selection: "selected" | "not-applicable";
    readonly semantics: "blocking" | "advisory";
    readonly outcome: "passed" | "failed" | "not-applicable";
    readonly diagnostics: readonly string[];
    readonly receiptDigest: string | null;
    readonly attestationDigest: string;
  }[];
  readonly facts: {
    readonly tests: {
      readonly inventory: TestInventory;
      readonly profile: "ordinary" | "publish";
      readonly affectedOwners: readonly string[];
      readonly packagingOwners: readonly string[];
      readonly fast: LaneReport | null;
      readonly integration: LaneReport | null;
      readonly published: LaneReport | null;
      readonly generated: {
        readonly requiredSourcePaths: readonly string[];
        readonly executedSourcePaths: readonly string[];
        readonly materializations: readonly MaterializationEvidence[];
      };
    };
    readonly packageTasks: readonly PackageQualityRow[];
    readonly promotionArtifacts: readonly PromotionArtifactFact[];
    readonly bundleSize: BundleSizeWarningReport;
    readonly publicApi: PublicApiGuardResult;
    readonly securityPhysical: readonly SynthesisSecurityResult[];
    readonly productionReadyRequireTaskSummaries: boolean;
  };
  readonly synthesisPlan: readonly {
    readonly id: SynthesisCheckId;
    readonly selection: "selected" | "not-applicable";
    readonly dependsOn: readonly string[];
  }[];
  readonly synthesisInputDigest: string;
};

type AssembleSynthesisInputOptions = {
  readonly rootDir: string;
  readonly identity: ExperimentIdentity;
  readonly selection: SynthesisSelection;
  readonly producerDirectories: Readonly<Record<ProducerLane, string>>;
  readonly affectedOwners: readonly string[];
  readonly packagingOwners: readonly string[];
};

function reject(code: string, message: string): never {
  throw new VerificationProblem(code, "contract", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    reject("SYNTHESIS_SCHEMA_DRIFT", `${label} keys do not match the v1 contract.`);
  }
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    reject("INVALID_SYNTHESIS_INPUT", `${label} must be a non-empty string.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    reject("INVALID_SYNTHESIS_INPUT", `${label} must be a boolean.`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    reject("INVALID_PRODUCER_FACTS", `${label} must be a finite number.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) {
    reject("INVALID_PRODUCER_FACTS", `${label} must be a non-negative integer.`);
  }
  return parsed;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : finiteNumber(value, label);
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function nullableRelativePath(value: unknown, label: string): string | null {
  const parsed = nullableString(value, label);
  return parsed === null ? null : normalizedRelativePath(parsed, label);
}

function nullableNonNegativeNumber(value: unknown, label: string): number | null {
  const parsed = nullableNumber(value, label);
  if (parsed !== null && parsed < 0) {
    reject("INVALID_PRODUCER_FACTS", `${label} must be non-negative.`);
  }
  return parsed;
}

function enumeration<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    reject("INVALID_PRODUCER_FACTS", `${label} is invalid.`);
  }
  return value as T;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    reject("INVALID_SYNTHESIS_INPUT", `${label} must be a string array.`);
  }
  const parsed = value as readonly string[];
  if (new Set(parsed).size !== parsed.length) {
    reject("DUPLICATE_SYNTHESIS_INPUT", `${label} must not contain duplicates.`);
  }
  return parsed;
}

function repositoryPathArray(value: unknown, label: string): readonly string[] {
  const parsed = stringArray(value, label);
  for (const path of parsed) {
    if (validateRepositoryPath(path)) {
      reject("INVALID_PRODUCER_FACTS", `${label} contains an invalid repository path: ${path}`);
    }
  }
  return [...parsed].sort();
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertDigest(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    reject("INVALID_SYNTHESIS_DIGEST", `${label} must be a lowercase SHA-256 digest.`);
  }
  return parsed;
}

function assertCommitSha(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^[a-f0-9]{40}$/.test(parsed)) {
    reject("INVALID_SYNTHESIS_COMMIT", `${label} must be a lowercase 40-character Git SHA.`);
  }
  return parsed;
}

function normalizedRelativePath(value: string, label: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    reject("UNSAFE_SYNTHESIS_PATH", `${label} must be a normalized relative path.`);
  }
  return normalized;
}

function assertIdentity(actual: ProducerBundle, expected: ExperimentIdentity): void {
  for (const field of [
    "architectureVersion",
    "commitSha",
    "runId",
    "runAttempt",
    "profile",
    "manifestDigest",
    "inventoryDigest",
    "toolchainDigest",
    "inputDigest",
    "verificationExperimentId",
  ] as const) {
    if (actual[field] !== expected[field]) {
      reject(
        "SYNTHESIS_PRODUCER_IDENTITY_DRIFT",
        `${actual.lane}.${field} does not match the synthesis identity.`,
      );
    }
  }
}

function walkRegularFiles(root: string, current = root): readonly string[] {
  const metadata = lstatSync(current);
  if (metadata.isSymbolicLink()) {
    reject(
      "SYNTHESIS_ARTIFACT_SYMLINK",
      `Downloaded producer artifact contains a symbolic link: ${current}`,
    );
  }
  if (metadata.isFile()) return [current];
  if (!metadata.isDirectory()) {
    reject(
      "SYNTHESIS_ARTIFACT_NON_FILE",
      `Downloaded producer artifact contains a non-file entry: ${current}`,
    );
  }
  return readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => walkRegularFiles(root, join(current, entry.name)));
}

function verifyDownloadedArtifact(
  repositoryRoot: string,
  downloadedRoot: string,
  bundle: ProducerBundle,
): ReadonlyMap<string, string> {
  const expectedPrefix = `ci-reports/cacheable-ci/${bundle.lane}/`;
  const bundlePath = join(downloadedRoot, "producer-bundle.json");
  const actualFiles = walkRegularFiles(downloadedRoot)
    .filter((path) => resolve(path) !== resolve(bundlePath))
    .map((path) => relative(downloadedRoot, path).replaceAll("\\", "/"))
    .sort();
  const expectedFiles = bundle.artifact.files.map(({ path }) => {
    const normalized = normalizedRelativePath(path, `${bundle.lane}.artifact.files.path`);
    if (!normalized.startsWith(expectedPrefix)) {
      reject("SYNTHESIS_ARTIFACT_PREFIX_MISMATCH", `${normalized} is not owned by ${bundle.lane}.`);
    }
    return normalized.slice(expectedPrefix.length);
  });
  if (JSON.stringify(actualFiles) !== JSON.stringify([...expectedFiles].sort())) {
    reject(
      "SYNTHESIS_ARTIFACT_FILE_SET_MISMATCH",
      `${bundle.lane} downloaded files do not exactly match its bundle.`,
    );
  }
  const repositoryRelativeBySuffix = new Map<string, string>();
  for (const output of bundle.artifact.files) {
    const suffix = output.path.slice(expectedPrefix.length);
    const downloadedPath = resolve(downloadedRoot, suffix);
    const relativePath = relative(resolve(downloadedRoot), downloadedPath).replaceAll("\\", "/");
    if (relativePath.startsWith("../") || isAbsolute(relativePath)) {
      reject(
        "SYNTHESIS_ARTIFACT_PATH_ESCAPE",
        `${output.path} escapes its downloaded artifact root.`,
      );
    }
    const metadata = lstatSync(downloadedPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      reject("SYNTHESIS_ARTIFACT_NON_FILE", `${output.path} is not a regular immutable file.`);
    }
    const contents = readFileSync(downloadedPath);
    if (metadata.size !== output.bytes || sha256(contents) !== output.digest) {
      reject(
        "SYNTHESIS_ARTIFACT_CONTENT_MISMATCH",
        `${output.path} bytes or digest do not match its bundle.`,
      );
    }
    repositoryRelativeBySuffix.set(
      suffix,
      relative(repositoryRoot, downloadedPath).replaceAll("\\", "/"),
    );
  }
  return repositoryRelativeBySuffix;
}

function parsePackageQualityRows(value: unknown): readonly PackageQualityRow[] {
  if (!Array.isArray(value)) reject("INVALID_PRODUCER_FACTS", "packageTasks must be an array.");
  const taskNames = ["build", "typecheck", "test"] as const;
  const statuses = ["pass", "fail", "not-collected", "not-configured", "not-run"] as const;
  const rows = value.map((entry, index): PackageQualityRow => {
    if (!isRecord(entry))
      reject("INVALID_PRODUCER_FACTS", `packageTasks[${index}] must be an object.`);
    assertExactKeys(
      entry,
      ["packageName", "relativeDir", "private", "tasks"],
      `packageTasks[${index}]`,
    );
    if (!isRecord(entry.tasks))
      reject("INVALID_PRODUCER_FACTS", `packageTasks[${index}].tasks must be an object.`);
    assertExactKeys(entry.tasks, taskNames, `packageTasks[${index}].tasks`);
    const tasks = Object.fromEntries(
      taskNames.map((task) => {
        const taskValue = entry.tasks[task];
        if (!isRecord(taskValue))
          reject(
            "INVALID_PRODUCER_FACTS",
            `packageTasks[${index}].tasks.${task} must be an object.`,
          );
        assertExactKeys(
          taskValue,
          ["task", "status", "taskId", "logFile", "cacheStatus"],
          `packageTasks[${index}].tasks.${task}`,
        );
        if (taskValue.task !== task)
          reject(
            "INVALID_PRODUCER_FACTS",
            `packageTasks[${index}].tasks.${task}.task must equal ${task}.`,
          );
        return [
          task,
          {
            task,
            status: enumeration(
              taskValue.status,
              statuses,
              `packageTasks[${index}].tasks.${task}.status`,
            ),
            taskId: nullableString(taskValue.taskId, `packageTasks[${index}].tasks.${task}.taskId`),
            logFile: nullableString(
              taskValue.logFile,
              `packageTasks[${index}].tasks.${task}.logFile`,
            ),
            cacheStatus: nullableString(
              taskValue.cacheStatus,
              `packageTasks[${index}].tasks.${task}.cacheStatus`,
            ),
          },
        ];
      }),
    ) as PackageQualityRow["tasks"];
    return {
      packageName: string(entry.packageName, `packageTasks[${index}].packageName`),
      relativeDir: normalizedRelativePath(
        string(entry.relativeDir, `packageTasks[${index}].relativeDir`),
        `packageTasks[${index}].relativeDir`,
      ),
      private: boolean(entry.private, `packageTasks[${index}].private`),
      tasks,
    };
  });
  if (new Set(rows.map(({ packageName }) => packageName)).size !== rows.length) {
    reject("DUPLICATE_PRODUCER_FACTS", "packageTasks must not contain duplicate package names.");
  }
  return rows;
}

function parseBundleSize(value: unknown): BundleSizeWarningReport {
  if (!isRecord(value)) reject("INVALID_PRODUCER_FACTS", "bundleSize must be an object.");
  const keys = [
    "ciMode",
    "enforceSpineBundleSize",
    "baselinePath",
    "reportPath",
    "localCommand",
    "deltaPolicy",
    "spinePackageNames",
    "measuredPackageCount",
    "artifactCount",
    "missingBaselineCount",
    "overBaselineCount",
    "unmatchedBaselineCount",
    "notBuiltPackageCount",
    "spineBlockingRegressionCount",
    "spineBlockingSetupIssueCount",
    "spineBlockingUnmatchedBaselineCount",
    "spineBlockingIssueCount",
    "nonSpineAdvisoryWarningCount",
    "advisoryWarningCount",
    "unmatchedBaselines",
    "blockingUnmatchedBaselines",
    "artifacts",
  ] as const;
  assertExactKeys(value, keys, "bundleSize");
  if (!isRecord(value.deltaPolicy))
    reject("INVALID_PRODUCER_FACTS", "bundleSize.deltaPolicy must be an object.");
  assertExactKeys(
    value.deltaPolicy,
    ["kind", "allowedPositiveDeltaBytes", "description"],
    "bundleSize.deltaPolicy",
  );
  if (value.deltaPolicy.kind !== "global")
    reject("INVALID_PRODUCER_FACTS", "bundleSize.deltaPolicy.kind must be global.");
  if (!Array.isArray(value.artifacts))
    reject("INVALID_PRODUCER_FACTS", "bundleSize.artifacts must be an array.");
  const artifacts = value.artifacts.map((entry, index) => {
    if (!isRecord(entry))
      reject("INVALID_PRODUCER_FACTS", `bundleSize.artifacts[${index}] must be an object.`);
    assertExactKeys(
      entry,
      [
        "packageName",
        "relativeDir",
        "scope",
        "artifactPath",
        "baselineKey",
        "sizeBytes",
        "baselineBytes",
        "deltaBytes",
        "deltaPercent",
        "allowedPositiveDeltaBytes",
        "status",
        "blocking",
        "blockingReason",
        "recoveryCommand",
      ],
      `bundleSize.artifacts[${index}]`,
    );
    return {
      packageName: string(entry.packageName, `bundleSize.artifacts[${index}].packageName`),
      relativeDir: normalizedRelativePath(
        string(entry.relativeDir, `bundleSize.artifacts[${index}].relativeDir`),
        `bundleSize.artifacts[${index}].relativeDir`,
      ),
      scope: enumeration(
        entry.scope,
        ["spine", "non-spine"],
        `bundleSize.artifacts[${index}].scope`,
      ),
      artifactPath: nullableRelativePath(
        entry.artifactPath,
        `bundleSize.artifacts[${index}].artifactPath`,
      ),
      baselineKey: nullableString(entry.baselineKey, `bundleSize.artifacts[${index}].baselineKey`),
      sizeBytes: nullableNonNegativeNumber(
        entry.sizeBytes,
        `bundleSize.artifacts[${index}].sizeBytes`,
      ),
      baselineBytes: nullableNonNegativeNumber(
        entry.baselineBytes,
        `bundleSize.artifacts[${index}].baselineBytes`,
      ),
      deltaBytes: nullableNumber(entry.deltaBytes, `bundleSize.artifacts[${index}].deltaBytes`),
      deltaPercent: nullableNumber(
        entry.deltaPercent,
        `bundleSize.artifacts[${index}].deltaPercent`,
      ),
      allowedPositiveDeltaBytes: nullableNonNegativeNumber(
        entry.allowedPositiveDeltaBytes,
        `bundleSize.artifacts[${index}].allowedPositiveDeltaBytes`,
      ),
      status: enumeration(
        entry.status,
        ["within-baseline", "over-baseline", "missing-baseline", "not-built"],
        `bundleSize.artifacts[${index}].status`,
      ),
      blocking: boolean(entry.blocking, `bundleSize.artifacts[${index}].blocking`),
      blockingReason: nullableString(
        entry.blockingReason,
        `bundleSize.artifacts[${index}].blockingReason`,
      ),
      recoveryCommand: string(
        entry.recoveryCommand,
        `bundleSize.artifacts[${index}].recoveryCommand`,
      ),
    };
  });
  const integerFields = keys.filter((key) => key.endsWith("Count"));
  const counts = Object.fromEntries(
    integerFields.map((key) => [key, nonNegativeInteger(value[key], `bundleSize.${key}`)]),
  );
  const spinePackageNames = stringArray(value.spinePackageNames, "bundleSize.spinePackageNames");
  const unmatchedBaselines = stringArray(value.unmatchedBaselines, "bundleSize.unmatchedBaselines");
  const blockingUnmatchedBaselines = stringArray(
    value.blockingUnmatchedBaselines,
    "bundleSize.blockingUnmatchedBaselines",
  );
  if (
    counts.artifactCount !== artifacts.length ||
    counts.unmatchedBaselineCount !== unmatchedBaselines.length ||
    counts.spineBlockingUnmatchedBaselineCount !== blockingUnmatchedBaselines.length
  ) {
    reject("INVALID_PRODUCER_FACTS", "bundleSize counters do not match their normalized arrays.");
  }
  return {
    ciMode: enumeration(value.ciMode, ["warning-only", "spine-blocking"], "bundleSize.ciMode"),
    enforceSpineBundleSize: boolean(
      value.enforceSpineBundleSize,
      "bundleSize.enforceSpineBundleSize",
    ),
    baselinePath: normalizedRelativePath(
      string(value.baselinePath, "bundleSize.baselinePath"),
      "bundleSize.baselinePath",
    ),
    reportPath: normalizedRelativePath(
      string(value.reportPath, "bundleSize.reportPath"),
      "bundleSize.reportPath",
    ),
    localCommand: string(value.localCommand, "bundleSize.localCommand"),
    deltaPolicy: {
      kind: "global",
      allowedPositiveDeltaBytes: nonNegativeInteger(
        value.deltaPolicy.allowedPositiveDeltaBytes,
        "bundleSize.deltaPolicy.allowedPositiveDeltaBytes",
      ),
      description: string(value.deltaPolicy.description, "bundleSize.deltaPolicy.description"),
    },
    spinePackageNames,
    ...(counts as Omit<
      BundleSizeWarningReport,
      | "ciMode"
      | "enforceSpineBundleSize"
      | "baselinePath"
      | "reportPath"
      | "localCommand"
      | "deltaPolicy"
      | "spinePackageNames"
      | "unmatchedBaselines"
      | "blockingUnmatchedBaselines"
      | "artifacts"
    >),
    unmatchedBaselines,
    blockingUnmatchedBaselines,
    artifacts,
  };
}

function parsePublicApi(value: unknown): PublicApiGuardResult {
  if (!isRecord(value)) reject("INVALID_PRODUCER_FACTS", "publicApi must be an object.");
  const countFields = [
    "packageCount",
    "changedPackages",
    "changedEntrypoints",
    "entrypointsAdded",
    "entrypointsRemoved",
    "targetChanges",
    "runtimeAdded",
    "runtimeRemoved",
    "typeAdded",
    "typeRemoved",
  ] as const;
  assertExactKeys(
    value,
    ["status", ...countFields, "snapshotPath", "reportPath", "updateCommand"],
    "publicApi",
  );
  const counts = Object.fromEntries(
    countFields.map((field) => [
      field,
      value[field] === null ? null : nonNegativeInteger(value[field], `publicApi.${field}`),
    ]),
  );
  return {
    status: enumeration(value.status, ["pass", "fail", "not-collected"], "publicApi.status"),
    ...(counts as Pick<PublicApiGuardResult, (typeof countFields)[number]>),
    snapshotPath: normalizedRelativePath(
      string(value.snapshotPath, "publicApi.snapshotPath"),
      "publicApi.snapshotPath",
    ),
    reportPath: normalizedRelativePath(
      string(value.reportPath, "publicApi.reportPath"),
      "publicApi.reportPath",
    ),
    updateCommand: string(value.updateCommand, "publicApi.updateCommand"),
  };
}

function parsePromotionArtifacts(value: unknown): readonly PromotionArtifactFact[] {
  if (!Array.isArray(value))
    reject("INVALID_PRODUCER_FACTS", "promotionArtifacts must be an array.");
  return value.map((entry, index) => {
    if (!isRecord(entry))
      reject("INVALID_PRODUCER_FACTS", `promotionArtifacts[${index}] must be an object.`);
    assertExactKeys(
      entry,
      ["commandId", "path", "digest", "semanticStatus"],
      `promotionArtifacts[${index}]`,
    );
    const semanticStatus = string(
      entry.semanticStatus,
      `promotionArtifacts[${index}].semanticStatus`,
    );
    if (
      semanticStatus !== "passed" &&
      semanticStatus !== "failed" &&
      semanticStatus !== "unknown"
    ) {
      reject("INVALID_PRODUCER_FACTS", `promotionArtifacts[${index}].semanticStatus is invalid.`);
    }
    return {
      commandId: string(entry.commandId, `promotionArtifacts[${index}].commandId`),
      path: normalizedRelativePath(
        string(entry.path, `promotionArtifacts[${index}].path`),
        `promotionArtifacts[${index}].path`,
      ),
      digest: assertDigest(entry.digest, `promotionArtifacts[${index}].digest`),
      semanticStatus,
    };
  });
}

export function parseSecurityPhysicalResults(value: unknown): readonly SynthesisSecurityResult[] {
  if (!Array.isArray(value)) reject("INVALID_PRODUCER_FACTS", "securityPhysical must be an array.");
  const expected = SECURITY_OWNERSHIP.filter(({ owner }) => owner === "coverage-security");
  const results = value.map((entry, index): SynthesisSecurityResult => {
    if (!isRecord(entry))
      reject("INVALID_PRODUCER_FACTS", `securityPhysical[${index}] must be an object.`);
    assertExactKeys(
      entry,
      ["id", "owner", "semantics", "outcome", "diagnostics"],
      `securityPhysical[${index}]`,
    );
    const id = string(entry.id, `securityPhysical[${index}].id`);
    const ownership = expected.find((candidate) => candidate.id === id);
    if (!ownership || entry.owner !== ownership.owner || entry.semantics !== ownership.semantics) {
      reject(
        "SECURITY_PHYSICAL_SEMANTICS_MISMATCH",
        `${id} security ownership or semantics drifted.`,
      );
    }
    return {
      id,
      owner: ownership.owner,
      semantics: ownership.semantics,
      outcome: enumeration(
        entry.outcome,
        ["passed", "failed"],
        `securityPhysical[${index}].outcome`,
      ),
      diagnostics: (() => {
        const parsed = stringArray(entry.diagnostics, `securityPhysical[${index}].diagnostics`);
        if (
          parsed.some((diagnostic) => diagnostic.length === 0) ||
          JSON.stringify(parsed) !== JSON.stringify([...parsed].sort())
        ) {
          reject(
            "INVALID_PRODUCER_FACTS",
            `securityPhysical[${index}].diagnostics must contain sorted non-empty strings.`,
          );
        }
        return parsed;
      })(),
    };
  });
  const ids = results.map(({ id }) => id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expected.map(({ id }) => id).sort())) {
    reject(
      "SECURITY_PHYSICAL_SET_MISMATCH",
      "coverage-security facts must contain exactly the three physical security results.",
    );
  }
  return results;
}

export function parseProducerFacts(value: unknown, expectedLane: ProducerLane): ProducerFacts {
  if (!isRecord(value))
    reject("INVALID_PRODUCER_FACTS", `${expectedLane} producer facts must be an object.`);
  if (value.schemaVersion !== PRODUCER_FACTS_SCHEMA || value.lane !== expectedLane) {
    reject(
      "PRODUCER_FACTS_IDENTITY_MISMATCH",
      `${expectedLane} producer facts schema or lane drifted.`,
    );
  }
  if (expectedLane === "core-verification") {
    assertExactKeys(
      value,
      [
        "schemaVersion",
        "lane",
        "inventory",
        "fastLane",
        "integrationLane",
        "packageTasks",
        "bundleSize",
        "productionReadyRequireTaskSummaries",
      ],
      expectedLane,
    );
    const inventory = parseStrictTestInventory(value.inventory);
    if (value.fastLane !== null) assertLaneReport(value.fastLane);
    if (value.integrationLane !== null) assertLaneReport(value.integrationLane);
    return {
      schemaVersion: PRODUCER_FACTS_SCHEMA,
      lane: expectedLane,
      inventory,
      fastLane: value.fastLane as LaneReport | null,
      integrationLane: value.integrationLane as LaneReport | null,
      packageTasks: parsePackageQualityRows(value.packageTasks),
      bundleSize: parseBundleSize(value.bundleSize),
      productionReadyRequireTaskSummaries: boolean(
        value.productionReadyRequireTaskSummaries,
        "productionReadyRequireTaskSummaries",
      ),
    };
  }
  if (expectedLane === "generated-apps") {
    assertExactKeys(
      value,
      [
        "schemaVersion",
        "lane",
        "requiredSourcePaths",
        "executedSourcePaths",
        "materializations",
        "promotionArtifacts",
      ],
      expectedLane,
    );
    const requiredSourcePaths = repositoryPathArray(
      value.requiredSourcePaths,
      "requiredSourcePaths",
    );
    const executedSourcePaths = repositoryPathArray(
      value.executedSourcePaths,
      "executedSourcePaths",
    );
    const materializations = parseMaterializationEvidence(value.materializations);
    const materializedSourcePaths = materializations.map(({ sourcePath }) => sourcePath);
    if (JSON.stringify(executedSourcePaths) !== JSON.stringify(materializedSourcePaths)) {
      reject(
        "MATERIALIZATION_EXECUTION_DRIFT",
        "executedSourcePaths must exactly match normalized materialization source paths.",
      );
    }
    return {
      schemaVersion: PRODUCER_FACTS_SCHEMA,
      lane: expectedLane,
      requiredSourcePaths,
      executedSourcePaths,
      materializations,
      promotionArtifacts: parsePromotionArtifacts(value.promotionArtifacts),
    };
  }
  if (expectedLane === "package-artifacts") {
    assertExactKeys(
      value,
      ["schemaVersion", "lane", "publishedLane", "publicApi", "promotionArtifacts"],
      expectedLane,
    );
    if (value.publishedLane !== null) assertLaneReport(value.publishedLane);
    return {
      schemaVersion: PRODUCER_FACTS_SCHEMA,
      lane: expectedLane,
      publishedLane: value.publishedLane as LaneReport | null,
      publicApi: parsePublicApi(value.publicApi),
      promotionArtifacts: parsePromotionArtifacts(value.promotionArtifacts),
    };
  }
  assertExactKeys(value, ["schemaVersion", "lane", "securityPhysical"], expectedLane);
  return {
    schemaVersion: PRODUCER_FACTS_SCHEMA,
    lane: "coverage-security",
    securityPhysical: parseSecurityPhysicalResults(value.securityPhysical),
  };
}

function synthesisPlan(selection: SynthesisSelection): SynthesisInput["synthesisPlan"] {
  const selected = new Set(selection.selectedCheckIds);
  const dependencies: Readonly<Record<SynthesisCheckId, readonly string[]>> = {
    "test-evidence-reconcile": [
      "test",
      "integration-test-lane",
      "published-test-lane",
      "generated-app-smoke",
    ],
    "production-ready": ["build", "typecheck", "test", "test-evidence-reconcile"],
    "spine-promotion": [
      "test",
      "generated-app-smoke",
      "provider-certification",
      "production-ready",
    ],
    "spine-bundle-size": [
      "changeset-required",
      "lint",
      "format",
      "build",
      "typecheck",
      "test",
      "provider-certification",
      "production-ready",
      "spine-promotion",
    ],
  };
  return SYNTHESIS_CHECK_IDS.map((id) => ({
    id,
    selection: selected.has(id) ? "selected" : "not-applicable",
    dependsOn: dependencies[id],
  }));
}

function parseSelection(value: unknown): SynthesisSelection {
  if (!isRecord(value)) reject("INVALID_SYNTHESIS_INPUT", "selection must be an object.");
  assertExactKeys(
    value,
    ["baseSha", "headSha", "changedFilesDigest", "inventoryFileDigest", "selectedCheckIds"],
    "selection",
  );
  return {
    baseSha: assertCommitSha(value.baseSha, "selection.baseSha"),
    headSha: assertCommitSha(value.headSha, "selection.headSha"),
    changedFilesDigest: assertDigest(value.changedFilesDigest, "selection.changedFilesDigest"),
    inventoryFileDigest: assertDigest(value.inventoryFileDigest, "selection.inventoryFileDigest"),
    selectedCheckIds: stringArray(value.selectedCheckIds, "selection.selectedCheckIds"),
  };
}

function parseProducerReferences(value: unknown): SynthesisInput["producers"] {
  if (!Array.isArray(value)) reject("INVALID_SYNTHESIS_INPUT", "producers must be an array.");
  const producers = value.map((entry, index) => {
    if (!isRecord(entry))
      reject("INVALID_SYNTHESIS_INPUT", `producers[${index}] must be an object.`);
    assertExactKeys(
      entry,
      ["lane", "artifactName", "bundleDigest", "outputDigest", "status"],
      `producers[${index}]`,
    );
    const lane = string(entry.lane, `producers[${index}].lane`);
    if (!PRODUCER_LANES.includes(lane as ProducerLane)) {
      reject("UNEXPECTED_SYNTHESIS_PRODUCER", `${lane} is not a producer lane.`);
    }
    const status = string(entry.status, `producers[${index}].status`);
    if (status !== "success" && status !== "failure") {
      reject("INVALID_SYNTHESIS_INPUT", `producers[${index}].status is invalid.`);
    }
    return {
      lane: lane as ProducerLane,
      artifactName: string(entry.artifactName, `producers[${index}].artifactName`),
      bundleDigest: assertDigest(entry.bundleDigest, `producers[${index}].bundleDigest`),
      outputDigest: assertDigest(entry.outputDigest, `producers[${index}].outputDigest`),
      status,
    };
  });
  const lanes = producers.map(({ lane }) => lane);
  if (
    producers.length !== PRODUCER_LANES.length ||
    new Set(lanes).size !== lanes.length ||
    PRODUCER_LANES.some((lane) => !lanes.includes(lane))
  ) {
    reject("SYNTHESIS_PRODUCER_SET_MISMATCH", "producers must contain exactly the four lanes.");
  }
  return producers;
}

function parseProducerResults(value: unknown): SynthesisInput["producerResults"] {
  if (!Array.isArray(value)) reject("INVALID_SYNTHESIS_INPUT", "producerResults must be an array.");
  const results = value.map((entry, index) => {
    if (!isRecord(entry))
      reject("INVALID_SYNTHESIS_INPUT", `producerResults[${index}] must be an object.`);
    assertExactKeys(
      entry,
      [
        "id",
        "lane",
        "selection",
        "semantics",
        "outcome",
        "diagnostics",
        "receiptDigest",
        "attestationDigest",
      ],
      `producerResults[${index}]`,
    );
    const id = string(entry.id, `producerResults[${index}].id`);
    const lane = string(entry.lane, `producerResults[${index}].lane`);
    const selection = string(entry.selection, `producerResults[${index}].selection`);
    const semantics = string(entry.semantics, `producerResults[${index}].semantics`);
    const outcome = string(entry.outcome, `producerResults[${index}].outcome`);
    if (!PRODUCER_LANES.includes(lane as ProducerLane)) {
      reject("UNEXPECTED_SYNTHESIS_PRODUCER", `${id} has unknown producer ${lane}.`);
    }
    if (VERIFICATION_LANE_OWNERSHIP[id as keyof typeof VERIFICATION_LANE_OWNERSHIP] !== lane) {
      reject("SYNTHESIS_RESULT_OWNER_MISMATCH", `${id} is not owned by ${lane}.`);
    }
    if (selection !== "selected" && selection !== "not-applicable") {
      reject("INVALID_SYNTHESIS_INPUT", `${id} selection is invalid.`);
    }
    if (semantics !== "blocking" && semantics !== "advisory") {
      reject("INVALID_SYNTHESIS_INPUT", `${id} semantics are invalid.`);
    }
    if (outcome !== "passed" && outcome !== "failed" && outcome !== "not-applicable") {
      reject("INVALID_SYNTHESIS_INPUT", `${id} outcome is invalid.`);
    }
    if ((selection === "not-applicable") !== (outcome === "not-applicable")) {
      reject("SYNTHESIS_RESULT_SELECTION_MISMATCH", `${id} selection and outcome disagree.`);
    }
    const receiptDigest =
      entry.receiptDigest === null
        ? null
        : assertDigest(entry.receiptDigest, `producerResults[${index}].receiptDigest`);
    if (outcome === "passed" && receiptDigest === null) {
      reject("SYNTHESIS_PASSED_WITHOUT_RECEIPT", `${id} passed without a receipt.`);
    }
    return {
      id,
      lane: lane as ProducerLane,
      selection,
      semantics,
      outcome,
      diagnostics: stringArray(entry.diagnostics, `producerResults[${index}].diagnostics`),
      receiptDigest,
      attestationDigest: assertDigest(
        entry.attestationDigest,
        `producerResults[${index}].attestationDigest`,
      ),
    };
  });
  const expectedIds = Object.entries(VERIFICATION_LANE_OWNERSHIP)
    .filter(([, lane]) => lane !== "split-validation-shadow")
    .map(([id]) => id)
    .sort();
  const actualIds = results.map(({ id }) => id);
  if (
    new Set(actualIds).size !== actualIds.length ||
    JSON.stringify([...actualIds].sort()) !== JSON.stringify(expectedIds)
  ) {
    reject(
      "SYNTHESIS_PRODUCER_RESULT_SET_MISMATCH",
      "producerResults must contain every producer-owned check exactly once.",
    );
  }
  return results;
}

function parseFacts(value: unknown, identity: ExperimentIdentity): SynthesisInput["facts"] {
  if (!isRecord(value)) reject("INVALID_SYNTHESIS_INPUT", "facts must be an object.");
  assertExactKeys(
    value,
    [
      "tests",
      "packageTasks",
      "promotionArtifacts",
      "bundleSize",
      "publicApi",
      "securityPhysical",
      "productionReadyRequireTaskSummaries",
    ],
    "facts",
  );
  if (!isRecord(value.tests)) reject("INVALID_SYNTHESIS_INPUT", "facts.tests must be an object.");
  assertExactKeys(
    value.tests,
    [
      "inventory",
      "profile",
      "affectedOwners",
      "packagingOwners",
      "fast",
      "integration",
      "published",
      "generated",
    ],
    "facts.tests",
  );
  const inventory = parseStrictTestInventory(value.tests.inventory);
  if (inventoryDigest(inventory) !== identity.inventoryDigest) {
    reject(
      "SYNTHESIS_INVENTORY_DIGEST_MISMATCH",
      "facts inventory does not match the experiment identity.",
    );
  }
  const profile = string(value.tests.profile, "facts.tests.profile");
  if (profile !== "ordinary" && profile !== "publish") {
    reject("INVALID_SYNTHESIS_INPUT", "facts.tests.profile is invalid.");
  }
  if (value.tests.fast !== null) assertLaneReport(value.tests.fast);
  if (value.tests.integration !== null) assertLaneReport(value.tests.integration);
  if (value.tests.published !== null) assertLaneReport(value.tests.published);
  if (!isRecord(value.tests.generated)) {
    reject("INVALID_SYNTHESIS_INPUT", "facts.tests.generated must be an object.");
  }
  assertExactKeys(
    value.tests.generated,
    ["requiredSourcePaths", "executedSourcePaths", "materializations"],
    "facts.tests.generated",
  );
  const requiredSourcePaths = repositoryPathArray(
    value.tests.generated.requiredSourcePaths,
    "facts.tests.generated.requiredSourcePaths",
  );
  const executedSourcePaths = repositoryPathArray(
    value.tests.generated.executedSourcePaths,
    "facts.tests.generated.executedSourcePaths",
  );
  const materializations = parseMaterializationEvidence(
    value.tests.generated.materializations,
    identity.inventoryDigest,
  );
  if (
    JSON.stringify(executedSourcePaths) !==
    JSON.stringify(materializations.map(({ sourcePath }) => sourcePath))
  ) {
    reject(
      "MATERIALIZATION_EXECUTION_DRIFT",
      "facts generated executed paths must match normalized materialization source paths.",
    );
  }
  return {
    tests: {
      inventory,
      profile,
      affectedOwners: stringArray(value.tests.affectedOwners, "facts.tests.affectedOwners"),
      packagingOwners: stringArray(value.tests.packagingOwners, "facts.tests.packagingOwners"),
      fast: value.tests.fast as LaneReport | null,
      integration: value.tests.integration as LaneReport | null,
      published: value.tests.published as LaneReport | null,
      generated: {
        requiredSourcePaths,
        executedSourcePaths,
        materializations,
      },
    },
    packageTasks: parsePackageQualityRows(value.packageTasks),
    promotionArtifacts: parsePromotionArtifacts(value.promotionArtifacts),
    bundleSize: parseBundleSize(value.bundleSize),
    publicApi: parsePublicApi(value.publicApi),
    securityPhysical: parseSecurityPhysicalResults(value.securityPhysical),
    productionReadyRequireTaskSummaries: boolean(
      value.productionReadyRequireTaskSummaries,
      "facts.productionReadyRequireTaskSummaries",
    ),
  };
}

function parseSynthesisPlan(
  value: unknown,
  selection: SynthesisSelection,
): SynthesisInput["synthesisPlan"] {
  if (!Array.isArray(value)) reject("INVALID_SYNTHESIS_INPUT", "synthesisPlan must be an array.");
  const parsed = value.map((entry, index) => {
    if (!isRecord(entry))
      reject("INVALID_SYNTHESIS_INPUT", `synthesisPlan[${index}] must be an object.`);
    assertExactKeys(entry, ["id", "selection", "dependsOn"], `synthesisPlan[${index}]`);
    const id = string(entry.id, `synthesisPlan[${index}].id`);
    if (!SYNTHESIS_CHECK_IDS.includes(id as SynthesisCheckId)) {
      reject("UNEXPECTED_SYNTHESIS_CHECK", `${id} is not a synthesis check.`);
    }
    const checkSelection = string(entry.selection, `synthesisPlan[${index}].selection`);
    if (checkSelection !== "selected" && checkSelection !== "not-applicable") {
      reject("INVALID_SYNTHESIS_INPUT", `${id} synthesis selection is invalid.`);
    }
    return {
      id: id as SynthesisCheckId,
      selection: checkSelection,
      dependsOn: stringArray(entry.dependsOn, `synthesisPlan[${index}].dependsOn`),
    };
  });
  const expected = synthesisPlan(selection);
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
    reject(
      "SYNTHESIS_PLAN_DRIFT",
      "synthesisPlan does not match the manifest dependency contract.",
    );
  }
  return parsed;
}

export function parseSynthesisInput(value: unknown): SynthesisInput {
  if (!isRecord(value)) reject("INVALID_SYNTHESIS_INPUT", "synthesis input must be an object.");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "identity",
      "selection",
      "producers",
      "producerResults",
      "facts",
      "synthesisPlan",
      "synthesisInputDigest",
    ],
    "synthesisInput",
  );
  if (value.schemaVersion !== SYNTHESIS_INPUT_SCHEMA) {
    reject(
      "INVALID_SYNTHESIS_SCHEMA",
      `synthesisInput.schemaVersion must be ${SYNTHESIS_INPUT_SCHEMA}.`,
    );
  }
  const identity = parseExperimentIdentity(value.identity);
  const selection = parseSelection(value.selection);
  if (selection.headSha !== identity.commitSha) {
    reject("SYNTHESIS_HEAD_IDENTITY_MISMATCH", "selection.headSha must equal identity.commitSha.");
  }
  const selectionInputDigest = cacheableInputDigest({
    commitSha: identity.commitSha,
    workflowDigest: identity.manifestDigest,
    inventoryFileDigest: selection.inventoryFileDigest,
    toolchainDigest: identity.toolchainDigest,
    baseSha: selection.baseSha,
    changedFilesDigest: selection.changedFilesDigest,
  });
  if (selectionInputDigest !== identity.inputDigest) {
    reject(
      "SYNTHESIS_SELECTION_IDENTITY_MISMATCH",
      "selection base/head and changed files are not bound by identity.inputDigest.",
    );
  }
  const producers = parseProducerReferences(value.producers);
  const producerResults = parseProducerResults(value.producerResults);
  const facts = parseFacts(value.facts, identity);
  const plan = parseSynthesisPlan(value.synthesisPlan, selection);
  const expectedSelected = new Set(selection.selectedCheckIds);
  for (const result of producerResults) {
    if ((result.selection === "selected") !== expectedSelected.has(result.id)) {
      reject("SYNTHESIS_SELECTION_MISMATCH", `${result.id} producer selection drifted.`);
    }
  }
  const parsed: SynthesisInput = {
    schemaVersion: SYNTHESIS_INPUT_SCHEMA,
    identity,
    selection,
    producers,
    producerResults,
    facts,
    synthesisPlan: plan,
    synthesisInputDigest: assertDigest(
      value.synthesisInputDigest,
      "synthesisInput.synthesisInputDigest",
    ),
  };
  const computed = evidenceDigest(
    Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "synthesisInputDigest")),
  );
  if (computed !== parsed.synthesisInputDigest) {
    reject(
      "SYNTHESIS_INPUT_DIGEST_MISMATCH",
      "synthesisInputDigest does not bind the complete normalized input.",
    );
  }
  return parsed;
}

export function assembleSynthesisInput(options: AssembleSynthesisInputOptions): SynthesisInput {
  const identity = parseExperimentIdentity(options.identity);
  const selectedCheckIds = stringArray(
    options.selection.selectedCheckIds,
    "selection.selectedCheckIds",
  );
  const selection: SynthesisSelection = {
    baseSha: assertCommitSha(options.selection.baseSha, "selection.baseSha"),
    headSha: assertCommitSha(options.selection.headSha, "selection.headSha"),
    changedFilesDigest: assertDigest(
      options.selection.changedFilesDigest,
      "selection.changedFilesDigest",
    ),
    inventoryFileDigest: assertDigest(
      options.selection.inventoryFileDigest,
      "selection.inventoryFileDigest",
    ),
    selectedCheckIds,
  };
  if (selection.headSha !== identity.commitSha) {
    reject("SYNTHESIS_HEAD_IDENTITY_MISMATCH", "selection.headSha must equal identity.commitSha.");
  }
  const bundles: ProducerBundle[] = [];
  const facts = new Map<ProducerLane, ProducerFacts>();
  for (const lane of PRODUCER_LANES) {
    const directory = resolve(options.producerDirectories[lane]);
    const bundleValue: unknown = JSON.parse(
      readFileSync(join(directory, "producer-bundle.json"), "utf8"),
    );
    const bundle = parseProducerBundle(bundleValue, `${lane}.bundle`);
    if (bundle.lane !== lane)
      reject("SYNTHESIS_PRODUCER_LANE_DRIFT", `${lane} artifact contains ${bundle.lane}.`);
    assertIdentity(bundle, identity);
    const paths = verifyDownloadedArtifact(resolve(options.rootDir), directory, bundle);
    const factPath = paths.get(PRODUCER_FACTS_FILE);
    if (!factPath)
      reject("MISSING_PRODUCER_FACTS", `${lane} bundle does not contain ${PRODUCER_FACTS_FILE}.`);
    const factValue: unknown = JSON.parse(readFileSync(resolve(options.rootDir, factPath), "utf8"));
    facts.set(lane, parseProducerFacts(factValue, lane));
    bundles.push(bundle);
  }
  const core = facts.get("core-verification") as CoreVerificationFacts | undefined;
  const generated = facts.get("generated-apps") as GeneratedAppsFacts | undefined;
  const packages = facts.get("package-artifacts") as PackageArtifactsFacts | undefined;
  const security = facts.get("coverage-security") as CoverageSecurityFacts | undefined;
  if (!core || !generated || !packages || !security) {
    reject("MISSING_PRODUCER_FACTS", "All four producer fact sets are required.");
  }
  const producers = bundles.map((bundle) => ({
    lane: bundle.lane,
    artifactName: bundle.artifact.name,
    bundleDigest: bundle.bundleDigest,
    outputDigest: bundle.outputDigest,
    status: bundle.status,
  }));
  const producerResults = bundles.flatMap((bundle) =>
    bundle.checks.map((check) => ({ ...check, lane: bundle.lane })),
  );
  const unsigned = {
    schemaVersion: SYNTHESIS_INPUT_SCHEMA,
    identity,
    selection,
    producers,
    producerResults,
    facts: {
      tests: {
        inventory: core.inventory,
        profile: identity.profile === "publish" ? ("publish" as const) : ("ordinary" as const),
        affectedOwners: [...options.affectedOwners],
        packagingOwners: [...options.packagingOwners],
        fast: core.fastLane,
        integration: core.integrationLane,
        published: packages.publishedLane,
        generated: {
          requiredSourcePaths: generated.requiredSourcePaths,
          executedSourcePaths: generated.executedSourcePaths,
          materializations: generated.materializations,
        },
      },
      packageTasks: core.packageTasks,
      promotionArtifacts: [...generated.promotionArtifacts, ...packages.promotionArtifacts],
      bundleSize: core.bundleSize,
      publicApi: packages.publicApi,
      securityPhysical: security.securityPhysical,
      productionReadyRequireTaskSummaries: core.productionReadyRequireTaskSummaries,
    },
    synthesisPlan: synthesisPlan(selection),
  };
  return parseSynthesisInput({ ...unsigned, synthesisInputDigest: evidenceDigest(unsigned) });
}

function values(args: readonly string[], flag: string): readonly string[] {
  return args.flatMap((entry, index) =>
    entry === flag && args[index + 1] ? [args[index + 1]] : [],
  );
}

function value(args: readonly string[], flag: string): string | undefined {
  return values(args, flag)[0];
}

function commandValues(command: readonly string[], flag: string): readonly string[] {
  return command.flatMap((entry, index) =>
    entry === flag && command[index + 1] ? [command[index + 1]] : [],
  );
}

export function assembleSynthesisInputFromRepository(args: readonly string[]): {
  readonly input: SynthesisInput;
  readonly outputPath: string;
} {
  const rootDir = resolve(value(args, "--root") ?? process.cwd());
  const identityPath = value(args, "--identity");
  const baseRef = value(args, "--base");
  const headRef = value(args, "--head");
  const output = value(args, "--output");
  if (!identityPath || !baseRef || !headRef || !output) {
    throw new Error("--identity, --base, --head, and --output are required");
  }
  const identity = parseExperimentIdentity(
    JSON.parse(readFileSync(resolve(rootDir, identityPath), "utf8")) as unknown,
  );
  const baseSha = resolveCommitSha(rootDir, baseRef);
  const headSha = resolveCommitSha(rootDir, headRef);
  if (headSha !== identity.commitSha) {
    reject("SYNTHESIS_HEAD_IDENTITY_MISMATCH", "Resolved --head must equal identity.commitSha.");
  }
  const changedFiles = readChangedFiles(rootDir, baseSha, headSha);
  const selectionChangedFilesDigest = changedFilesDigest(changedFiles);
  const inventoryFileDigest = digestFile(resolve(rootDir, "test-inventory.json"));
  const workflowDigest = digestFile(resolve(rootDir, ".github/workflows/ci.yml"));
  if (workflowDigest !== identity.manifestDigest) {
    reject(
      "SYNTHESIS_WORKFLOW_IDENTITY_MISMATCH",
      "Current CI workflow does not match identity.manifestDigest.",
    );
  }
  const expectedInputDigest = cacheableInputDigest({
    commitSha: identity.commitSha,
    workflowDigest,
    inventoryFileDigest,
    toolchainDigest: identity.toolchainDigest,
    baseSha,
    changedFilesDigest: selectionChangedFilesDigest,
  });
  if (expectedInputDigest !== identity.inputDigest) {
    reject(
      "SYNTHESIS_SELECTION_IDENTITY_MISMATCH",
      "Resolved base/head and changed files are not bound by identity.inputDigest.",
    );
  }
  const manifest = createVerificationManifest(identity.profile, {
    base: baseSha,
    head: headSha,
    changedFiles,
  });
  const reconcile = manifest.find(({ id }) => id === "test-evidence-reconcile");
  const producerDirectories = Object.fromEntries(
    PRODUCER_LANES.map((lane) => {
      const explicit = values(args, "--producer-dir")
        .map((entry) => entry.split("=", 2))
        .find(([candidate]) => candidate === lane)?.[1];
      return [lane, resolve(rootDir, explicit ?? join("incoming", lane))];
    }),
  ) as Record<ProducerLane, string>;
  const input = assembleSynthesisInput({
    rootDir,
    identity,
    selection: {
      baseSha,
      headSha,
      changedFilesDigest: selectionChangedFilesDigest,
      inventoryFileDigest,
      selectedCheckIds: manifest
        .filter(({ applicable }) => applicable !== false)
        .map(({ id }) => id),
    },
    producerDirectories,
    affectedOwners: reconcile ? commandValues(reconcile.command, "--affected-owner") : [],
    packagingOwners: reconcile ? commandValues(reconcile.command, "--packaging-owner") : [],
  });
  return { input, outputPath: resolve(rootDir, output) };
}

function main(args: readonly string[]): void {
  const { input, outputPath } = assembleSynthesisInputFromRepository(args);
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(input, null, 2)}\n`);
  renameSync(temporaryPath, outputPath);
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main(argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `[ci-synthesis-input] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}
