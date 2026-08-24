#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  LANE_OWNERSHIP,
  OBSERVATION_SCHEMA,
  parseObservation,
  type Observation,
  type ResultRecord,
} from "./ci-cacheable-lanes-evaluator.mts";
import {
  changedFilesDigest,
  createCacheableExperimentIdentity,
  readChangedFiles,
} from "./ci-cacheable-experiment-identity.mts";
import {
  injectedFailureCommandId,
  injectedFailureDiagnostic,
  parseCacheableFailureClass,
} from "./ci-cacheable-failure-injection.mts";
import {
  PRODUCER_LANES,
  evidenceDigest,
  parseExperimentIdentity,
  parseProducerBundle,
  parseSplitValidationShadowEvidence,
  type ProducerBundle,
  type ProducerLane,
  type SplitValidationShadowEvidence,
  type VerificationProfile,
} from "./ci-lane-evidence.mts";
import { parseSecurityPhysicalResults } from "./ci-synthesis-input.mts";
import { SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { inventoryDigest, parseStrictTestInventory } from "./test-inventory.mts";
import { createVerificationManifest } from "./verification-manifest.mts";
import { VerificationProblem } from "./verification-problem.mts";
import type { CacheableFailureClass } from "./ci-cacheable-failure-injection.mts";
import type { ExperimentIdentity } from "./ci-lane-evidence.mts";
import type { SecurityResultId } from "./ci-verification-contract.mts";

type Conclusion = "success" | "failure" | "cancelled";

type SourceRun = {
  readonly id: number;
  readonly run_attempt: number;
  readonly name: string;
  readonly event: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type SourceStep = {
  readonly name: string;
  readonly conclusion: string | null;
};

type SourceJob = {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly steps: readonly SourceStep[];
};

type SourceJobs = {
  readonly total_count: number;
  readonly jobs: readonly SourceJob[];
};

type SourceArtifact = {
  readonly name: string;
  readonly expired: boolean;
};

type SourceArtifacts = {
  readonly total_count: number;
  readonly artifacts: readonly SourceArtifact[];
};

type PerformanceSample = {
  readonly measurementScope: "validate-job";
  readonly runId: string;
  readonly jobId: string;
  readonly commitSha: string;
  readonly profile: VerificationProfile;
  readonly runnerOs: string;
  readonly runnerArch: string;
  readonly runnerLabel: string;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly cacheEvidenceComplete: boolean;
  readonly inventoryDigest: string;
  readonly workflowDigest: string;
  readonly conclusion: Conclusion;
  readonly retryAttempt: number;
  readonly injectedFailure?: string;
};

type VerificationCheck = {
  readonly id: string;
  readonly status: string;
  readonly errorCode: string | null;
  readonly failureReason: string | null;
};

type VerificationReport = {
  readonly schemaVersion: number;
  readonly profile: string;
  readonly provenance: {
    readonly commitSha: string;
    readonly runId: string;
    readonly runAttempt: string;
  };
  readonly checks: readonly VerificationCheck[];
};

type FastLaneCommand = {
  readonly owner: string;
  readonly status: string;
  readonly cacheStatus?: string;
};

type FastLaneReport = {
  readonly schemaVersion: string;
  readonly lane: string;
  readonly status: string;
  readonly inventoryDigest: string;
  readonly diagnostics: readonly unknown[];
  readonly skippedFiles: readonly unknown[];
  readonly commands: readonly FastLaneCommand[];
};

type PackageMetadata = {
  readonly packageManager?: string;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

export type CreateCiPerformanceObservationInput = {
  readonly run: unknown;
  readonly jobs: unknown;
  readonly executionSha: string;
  readonly rawSample: { readonly bytes: Buffer; readonly parsed: unknown };
  readonly verification: { readonly bytes: Buffer; readonly parsed: unknown };
  readonly fastLane: { readonly bytes: Buffer; readonly parsed: unknown };
  readonly inventoryBytes: Buffer;
  readonly packageMetadata: unknown;
  readonly artifacts?: unknown;
  readonly producerBundles?: readonly { readonly bytes: Buffer; readonly parsed: unknown }[];
  readonly splitValidationShadow?: { readonly bytes: Buffer; readonly parsed: unknown };
  readonly splitSecuritySummary?: { readonly bytes: Buffer; readonly parsed: unknown };
  readonly baseSha?: string;
  readonly changedFiles?: readonly string[];
  readonly sourceWorkflowBytes?: Buffer;
  readonly synthesisInput?: { readonly bytes: Buffer; readonly parsed: unknown };
};

const SECURITY_STEPS = [
  {
    id: "advisory-production-audit",
    name: "Production dependency audit report",
  },
  {
    id: "gitleaks-acceptance-smoke",
    name: "Security Gitleaks acceptance smoke",
  },
  { id: "blocking-secret-scan", name: "Secret scan blocking report" },
  {
    id: "security-policy-summary",
    name: "Assemble security policy summary",
  },
  { id: "security-upload", name: "Upload security report" },
] as const satisfies readonly {
  readonly id: SecurityResultId;
  readonly name: string;
}[];

const EXPECTED_CHECKS = Object.values(LANE_OWNERSHIP).flat();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${field} must be a non-empty string`);
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${field} must be a finite number`);
  return value;
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  field: string,
): void {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(`${field} must contain exactly ${normalizedExpected.join(", ")}`);
  }
}

function conclusion(value: unknown, field: string): Conclusion {
  if (value !== "success" && value !== "failure" && value !== "cancelled") {
    throw new Error(`${field} must be success, failure, or cancelled`);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  const text = requiredString(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${field} must be an ISO timestamp`);
  return text;
}

function sha256(parts: readonly (string | Buffer)[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function parseRun(value: unknown): SourceRun {
  if (!isRecord(value)) throw new Error("source run must be an object");
  return {
    id: requiredNumber(value.id, "source run id"),
    run_attempt: requiredNumber(value.run_attempt, "source run attempt"),
    name: requiredString(value.name, "source run name"),
    event: requiredString(value.event, "source run event"),
    status: requiredString(value.status, "source run status"),
    conclusion:
      value.conclusion === null ? null : requiredString(value.conclusion, "source run conclusion"),
    created_at: timestamp(value.created_at, "source run created_at"),
    updated_at: timestamp(value.updated_at, "source run updated_at"),
  };
}

function parseStep(value: unknown, index: number): SourceStep {
  if (!isRecord(value)) throw new Error(`source step ${index} must be an object`);
  return {
    name: requiredString(value.name, `source step ${index} name`),
    conclusion:
      value.conclusion === null
        ? null
        : requiredString(value.conclusion, `source step ${index} conclusion`),
  };
}

function parseJob(value: unknown, index: number): SourceJob {
  if (!isRecord(value) || !Array.isArray(value.steps))
    throw new Error(`source job ${index} must be an object with steps`);
  return {
    id: requiredNumber(value.id, `source job ${index} id`),
    name: requiredString(value.name, `source job ${index} name`),
    status: requiredString(value.status, `source job ${index} status`),
    conclusion:
      value.conclusion === null
        ? null
        : requiredString(value.conclusion, `source job ${index} conclusion`),
    started_at: timestamp(value.started_at, `source job ${index} started_at`),
    completed_at:
      value.completed_at === null
        ? null
        : timestamp(value.completed_at, `source job ${index} completed_at`),
    steps: value.steps.map(parseStep),
  };
}

function parseJobs(value: unknown): SourceJobs {
  if (!isRecord(value) || !Array.isArray(value.jobs))
    throw new Error("source jobs must contain a jobs array");
  const jobs = value.jobs.map(parseJob);
  const totalCount = requiredNumber(value.total_count, "source jobs total_count");
  if (totalCount !== jobs.length) {
    throw new Error(
      `source jobs response is incomplete: expected ${totalCount}, received ${jobs.length}`,
    );
  }
  return { total_count: totalCount, jobs };
}

function parseArtifacts(value: unknown): SourceArtifacts {
  if (!isRecord(value) || !Array.isArray(value.artifacts)) {
    throw new Error("source artifacts must contain an artifacts array");
  }
  const artifacts = value.artifacts.map((candidate, index): SourceArtifact => {
    if (!isRecord(candidate)) throw new Error(`source artifact ${index} must be an object`);
    if (typeof candidate.expired !== "boolean") {
      throw new Error(`source artifact ${index} expired must be a boolean`);
    }
    return {
      name: requiredString(candidate.name, `source artifact ${index} name`),
      expired: candidate.expired,
    };
  });
  const totalCount = requiredNumber(value.total_count, "source artifacts total_count");
  if (totalCount !== artifacts.length) {
    throw new Error(
      `source artifacts response is incomplete: expected ${totalCount}, received ${artifacts.length}`,
    );
  }
  return { total_count: totalCount, artifacts };
}

function parsePerformanceSample(value: unknown): PerformanceSample {
  if (!isRecord(value) || value.schemaVersion !== "croco.ci-performance-samples/v1") {
    throw new Error("performance sample has an unsupported schema");
  }
  if (!Array.isArray(value.currentSamples) || value.currentSamples.length !== 1) {
    throw new Error("performance sample must contain exactly one current sample");
  }
  const sample = value.currentSamples[0];
  if (!isRecord(sample)) throw new Error("performance current sample must be an object");
  return sample as PerformanceSample;
}

function parseVerificationReport(value: unknown): VerificationReport {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.checks)) {
    throw new Error("verification evidence has an unsupported schema");
  }
  if (!isRecord(value.provenance)) throw new Error("verification evidence provenance is missing");
  const checks = value.checks.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`verification check ${index} must be an object`);
    return {
      id: requiredString(candidate.id, `verification check ${index} id`),
      status: requiredString(candidate.status, `verification check ${index} status`),
      errorCode:
        candidate.errorCode === null
          ? null
          : requiredString(candidate.errorCode, `verification check ${index} errorCode`),
      failureReason:
        candidate.failureReason === null
          ? null
          : requiredString(candidate.failureReason, `verification check ${index} failureReason`),
    };
  });
  return {
    schemaVersion: 1,
    profile: requiredString(value.profile, "verification profile"),
    provenance: {
      commitSha: requiredString(value.provenance.commitSha, "verification provenance commitSha"),
      runId: requiredString(value.provenance.runId, "verification provenance runId"),
      runAttempt: requiredString(value.provenance.runAttempt, "verification provenance runAttempt"),
    },
    checks,
  };
}

function parseFastLane(value: unknown): FastLaneReport {
  if (
    !isRecord(value) ||
    !Array.isArray(value.commands) ||
    !Array.isArray(value.diagnostics) ||
    !Array.isArray(value.skippedFiles)
  ) {
    throw new Error("fast-lane evidence has an invalid schema");
  }
  const commands = value.commands.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`fast-lane command ${index} must be an object`);
    return {
      owner: requiredString(candidate.owner, `fast-lane command ${index} owner`),
      status: requiredString(candidate.status, `fast-lane command ${index} status`),
      ...(candidate.cacheStatus === undefined
        ? {}
        : {
            cacheStatus: requiredString(
              candidate.cacheStatus,
              `fast-lane command ${index} cacheStatus`,
            ),
          }),
    };
  });
  return {
    schemaVersion: requiredString(value.schemaVersion, "fast-lane schemaVersion"),
    lane: requiredString(value.lane, "fast-lane lane"),
    status: requiredString(value.status, "fast-lane status"),
    inventoryDigest: requiredString(value.inventoryDigest, "fast-lane inventoryDigest"),
    diagnostics: value.diagnostics,
    skippedFiles: value.skippedFiles,
    commands,
  };
}

function parsePackageMetadata(value: unknown): Required<PackageMetadata> {
  if (!isRecord(value) || !isRecord(value.devDependencies))
    throw new Error("trusted package metadata must define devDependencies");
  return {
    packageManager: requiredString(value.packageManager, "trusted packageManager"),
    devDependencies: Object.fromEntries(
      Object.entries(value.devDependencies).map(([name, version]) => [
        name,
        requiredString(version, `trusted devDependency ${name}`),
      ]),
    ),
  };
}

function stableDiagnostics(check: VerificationCheck): readonly string[] {
  if (check.status === "passed" || check.status === "not_applicable") return [];
  return [
    `${check.id}:${check.errorCode ?? check.failureReason ?? check.status}`
      .replace(/\s+/g, " ")
      .trim(),
  ];
}

function checkResult(check: VerificationCheck): ResultRecord {
  return {
    id: check.id,
    conclusion:
      check.status === "passed"
        ? "success"
        : check.status === "not_applicable"
          ? "not-selected"
          : "failure",
    semantics: check.id === "core-coverage-warning" ? "advisory" : "blocking",
    diagnostics: stableDiagnostics(check),
  };
}

function securityResult(job: SourceJob, contract: (typeof SECURITY_STEPS)[number]): ResultRecord {
  const steps = job.steps.filter(({ name }) => name === contract.name);
  if (steps.length !== 1)
    throw new Error(`validate job must contain exactly one ${contract.name} step`);
  const stepConclusion = steps[0].conclusion;
  return {
    id: contract.id,
    conclusion: stepConclusion === "success" ? "success" : "failure",
    semantics: securitySemantics(contract.id),
    diagnostics:
      stepConclusion === "success" ? [] : [`${contract.id}:${stepConclusion ?? "missing"}`],
  };
}

function securitySemantics(id: SecurityResultId): ResultRecord["semantics"] {
  const ownership = SECURITY_OWNERSHIP.find((entry) => entry.id === id);
  if (!ownership) throw new Error(`unknown security result ${id}`);
  return ownership.semantics === "blocking" || ownership.semantics === "acceptance-smoke"
    ? "blocking"
    : "advisory";
}

function exactStepConclusion(job: SourceJob, name: string): string | null {
  const steps = job.steps.filter((step) => step.name === name);
  if (steps.length !== 1) throw new Error(`${job.name} job must contain exactly one ${name} step`);
  return steps[0]?.conclusion ?? null;
}

function parseSplitSecuritySummary(
  value: unknown,
  shadow: SplitValidationShadowEvidence,
): readonly ReturnType<typeof parseSecurityPhysicalResults>[number][] {
  if (!isRecord(value)) throw new Error("split security policy summary must be an object");
  assertExactKeys(value, ["schemaVersion", "generatedAt", "results"], "split security summary");
  if (value.schemaVersion !== "croco.ci-split-security-policy-summary/v1") {
    throw new Error("split security policy summary has an unsupported schema");
  }
  if (timestamp(value.generatedAt, "split security summary generatedAt") !== shadow.completedAt) {
    throw new Error("split security policy summary timestamp does not match shadow evidence");
  }
  const results = parseSecurityPhysicalResults(value.results);
  const shadowResults = shadow.security.filter(({ owner }) => owner === "coverage-security");
  if (JSON.stringify(results) !== JSON.stringify(shadowResults)) {
    throw new Error("split security policy summary results do not match shadow evidence");
  }
  return results;
}

function assertSetEquality(
  actual: readonly string[],
  expected: readonly string[],
  field: string,
): void {
  const stable = (values: readonly string[]) => JSON.stringify([...values].sort());
  if (stable(actual) !== stable(expected))
    throw new Error(`${field} does not match the authoritative contract`);
}

const SPLIT_JOB_IDENTITIES = [...PRODUCER_LANES, "split-validation-shadow"] as const;

function exactJob(jobs: SourceJobs, name: string): SourceJob {
  const matches = jobs.jobs.filter((job) => job.name === name);
  if (matches.length !== 1) {
    throw new Error(`source run must contain exactly one ${name} job, found ${matches.length}`);
  }
  const job = matches[0];
  if (!job || job.status !== "completed" || job.completed_at === null) {
    throw new Error(`${name} job must be completed`);
  }
  return job;
}

function resultConclusion(
  value: "passed" | "failed" | "not-applicable",
): ResultRecord["conclusion"] {
  if (value === "passed") return "success";
  if (value === "failed") return "failure";
  return "not-selected";
}

function splitResult(result: {
  readonly id: string;
  readonly outcome: "passed" | "failed" | "not-applicable";
  readonly semantics: "blocking" | "advisory";
  readonly diagnostics: readonly string[];
}): ResultRecord {
  return {
    id: result.id,
    conclusion: resultConclusion(result.outcome),
    semantics: result.semantics,
    diagnostics: [...result.diagnostics],
  };
}

function splitSecurityResult(
  result: SplitValidationShadowEvidence["security"][number],
): ResultRecord {
  return {
    id: result.id,
    conclusion: resultConclusion(result.outcome),
    semantics: securitySemantics(result.id),
    diagnostics: [...result.diagnostics],
  };
}

function cacheTaskId(lane: ProducerLane, checkId: string): string {
  return `${lane}#${checkId}`;
}

function producerCacheEvidence(bundle: ProducerBundle): {
  readonly eligible: readonly string[];
  readonly hits: readonly string[];
} {
  const eligible = bundle.checks
    .filter(({ selection }) => selection === "selected")
    .map(({ id }) => cacheTaskId(bundle.lane, id));
  const receipts = new Map(bundle.receipts.map((receipt) => [receipt.checkId, receipt]));
  const hits = bundle.checks.flatMap(({ id, selection, receiptDigest }) => {
    if (selection !== "selected" || receiptDigest === null) return [];
    const receipt = receipts.get(id);
    if (!receipt) throw new Error(`${bundle.lane} is missing the receipt for ${id}`);
    return receipt.cache.origin === "executed" ? [] : [cacheTaskId(bundle.lane, id)];
  });
  return { eligible, hits };
}

function injectedFailure(sample: PerformanceSample): CacheableFailureClass {
  return parseCacheableFailureClass(sample.injectedFailure ?? "none");
}

function assertInjectedFailureEvidence(
  sourceEvent: string,
  failureClass: CacheableFailureClass,
  results: readonly ResultRecord[],
  architecture: string,
): void {
  if (failureClass === "none") return;
  if (sourceEvent !== "workflow_dispatch") {
    throw new VerificationProblem(
      "INVALID_INJECTED_FAILURE_SOURCE",
      "contract",
      "injected failure evidence requires a workflow_dispatch source run",
    );
  }
  const commandId = injectedFailureCommandId(failureClass);
  if (!commandId) {
    throw new VerificationProblem(
      "MISSING_INJECTED_FAILURE_MAPPING",
      "contract",
      `missing injected command mapping for ${failureClass}`,
    );
  }
  const matches = results.filter(({ id }) => id === commandId);
  const expectedDiagnostic = injectedFailureDiagnostic(commandId);
  if (
    matches.length !== 1 ||
    matches[0]?.conclusion !== "failure" ||
    JSON.stringify(matches[0].diagnostics) !== JSON.stringify([expectedDiagnostic])
  ) {
    throw new VerificationProblem(
      "INVALID_INJECTED_FAILURE_EVIDENCE",
      "contract",
      `${architecture} does not contain the exact injected failure evidence for ${failureClass}`,
    );
  }
}

function assertSplitArtifactSet(
  run: SourceRun,
  artifactsValue: unknown,
  splitEvidencePresent: boolean,
): void {
  if (artifactsValue === undefined) {
    if (splitEvidencePresent) throw new Error("split evidence requires source artifact metadata");
    return;
  }
  const artifacts = parseArtifacts(artifactsValue);
  const relevant = artifacts.artifacts.filter(({ name }) => name.startsWith("ci-lane-"));
  const expected = SPLIT_JOB_IDENTITIES.map(
    (identity) => `ci-lane-${identity}-${run.id}-${run.run_attempt}`,
  );
  if (relevant.length === 0) {
    if (splitEvidencePresent) throw new Error("split evidence artifacts are missing");
    return;
  }
  if (relevant.some(({ expired }) => expired))
    throw new Error("split evidence artifact is expired");
  assertSetEquality(
    relevant.map(({ name }) => name),
    expected,
    "split evidence artifact names",
  );
  if (new Set(relevant.map(({ name }) => name)).size !== relevant.length) {
    throw new Error("split evidence artifacts contain duplicates");
  }
  if (!splitEvidencePresent)
    throw new Error("source artifacts declare split evidence without input bytes");
}

function assertSplitIdentity(
  mono: Observation,
  bundle: ProducerBundle | SplitValidationShadowEvidence,
  label: string,
): void {
  const expected = {
    architectureVersion: "shadow-split",
    commitSha: mono.sourceSha,
    runId: mono.sourceRunId,
    runAttempt: mono.sourceAttempt,
    profile: mono.profile,
    manifestDigest: mono.manifestDigest,
    inventoryDigest: mono.inventoryDigest,
    toolchainDigest: mono.toolchainDigest,
    inputDigest: mono.inputDigest,
    verificationExperimentId: mono.verificationExperimentId,
  } as const;
  for (const field of Object.keys(expected) as readonly (keyof typeof expected)[]) {
    if (bundle[field] !== expected[field]) {
      throw new Error(`${label} ${field} does not match the monolithic observation identity`);
    }
  }
}

type SynthesisIdentityBinding = {
  readonly identity: ExperimentIdentity;
  readonly selection: {
    readonly baseSha: string;
    readonly headSha: string;
    readonly changedFilesDigest: string;
    readonly inventoryFileDigest: string;
    readonly selectedCheckIds: readonly string[];
  };
  readonly producers: readonly {
    readonly lane: ProducerLane;
    readonly bundleDigest: string;
  }[];
};

function digest(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (!/^[0-9a-f]{64}$/.test(parsed)) throw new Error(`${field} must be a SHA-256 digest`);
  return parsed;
}

function commitSha(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (!/^[0-9a-f]{40}$/.test(parsed)) throw new Error(`${field} must be a 40-character SHA`);
  return parsed;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${field} must not contain duplicates`);
  return value;
}

function parseSynthesisIdentityBinding(value: unknown): SynthesisIdentityBinding {
  if (!isRecord(value)) throw new Error("synthesis input must be an object");
  if (value.schemaVersion !== "croco.ci-synthesis-input/v1") {
    throw new Error("synthesis input has an unsupported schema");
  }
  const synthesisInputDigest = digest(value.synthesisInputDigest, "synthesis input digest");
  const unsigned = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "synthesisInputDigest"),
  );
  if (evidenceDigest(unsigned) !== synthesisInputDigest) {
    throw new Error("synthesis input digest does not bind the complete input");
  }
  const selection = value.selection;
  if (!isRecord(selection)) throw new Error("synthesis selection must be an object");
  assertExactKeys(
    selection,
    ["baseSha", "headSha", "changedFilesDigest", "inventoryFileDigest", "selectedCheckIds"],
    "synthesis selection",
  );
  if (!Array.isArray(value.producers)) throw new Error("synthesis producers must be an array");
  const producers = value.producers.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`synthesis producer ${index} must be an object`);
    const lane = requiredString(entry.lane, `synthesis producer ${index} lane`);
    if (!PRODUCER_LANES.includes(lane as ProducerLane)) {
      throw new Error(`synthesis producer ${index} has an unknown lane`);
    }
    return {
      lane: lane as ProducerLane,
      bundleDigest: digest(entry.bundleDigest, `synthesis producer ${index} bundle digest`),
    };
  });
  assertSetEquality(
    producers.map(({ lane }) => lane),
    PRODUCER_LANES,
    "synthesis producer lanes",
  );
  if (new Set(producers.map(({ lane }) => lane)).size !== producers.length) {
    throw new Error("synthesis producers contain duplicate lanes");
  }
  return {
    identity: parseExperimentIdentity(value.identity),
    selection: {
      baseSha: commitSha(selection.baseSha, "synthesis selection base SHA"),
      headSha: commitSha(selection.headSha, "synthesis selection head SHA"),
      changedFilesDigest: digest(
        selection.changedFilesDigest,
        "synthesis selection changed-files digest",
      ),
      inventoryFileDigest: digest(
        selection.inventoryFileDigest,
        "synthesis selection inventory-file digest",
      ),
      selectedCheckIds: stringArray(selection.selectedCheckIds, "synthesis selection check IDs"),
    },
    producers,
  };
}

function independentlyVerifiedPhaseBIdentity(
  monolithic: Observation,
  input: CreateCiPerformanceObservationInput,
): { readonly identity: ExperimentIdentity; readonly synthesis: SynthesisIdentityBinding } {
  if (
    !input.baseSha ||
    !input.changedFiles ||
    !input.sourceWorkflowBytes ||
    !input.synthesisInput
  ) {
    throw new Error(
      "Phase B observation requires the trusted base SHA, changed files, source workflow, and synthesis input",
    );
  }
  const baseSha = commitSha(input.baseSha, "source base SHA");
  const changedFiles = stringArray(input.changedFiles, "source changed files");
  const normalizedChangedFiles = [...changedFiles].sort();
  if (JSON.stringify(changedFiles) !== JSON.stringify(normalizedChangedFiles)) {
    throw new Error("source changed files must be sorted");
  }
  const workflowDigest = createHash("sha256").update(input.sourceWorkflowBytes).digest("hex");
  if (workflowDigest !== monolithic.manifestDigest) {
    throw new Error("source workflow bytes do not match the observed workflow digest");
  }
  const inventoryFileDigest = createHash("sha256").update(input.inventoryBytes).digest("hex");
  const inventoryValue = JSON.parse(input.inventoryBytes.toString("utf8")) as unknown;
  const inventoryModelDigest = inventoryDigest(parseStrictTestInventory(inventoryValue));
  if (inventoryModelDigest !== monolithic.inventoryDigest) {
    throw new Error("source inventory model does not match the observed inventory digest");
  }
  const identity = createCacheableExperimentIdentity({
    commitSha: monolithic.sourceSha,
    runId: monolithic.sourceRunId,
    runAttempt: monolithic.sourceAttempt,
    profile: monolithic.profile,
    runnerOs: monolithic.runnerOs,
    runnerArch: monolithic.runnerArch,
    runnerLabel: monolithic.runnerLabel,
    nodeVersion: monolithic.nodeVersion,
    pnpmVersion: monolithic.pnpmVersion,
    turboVersion: monolithic.turboVersion,
    packageManager: parsePackageMetadata(input.packageMetadata).packageManager,
    workflowDigest,
    inventoryDigest: inventoryModelDigest,
    inventoryFileDigest,
    baseSha,
    changedFilesDigest: changedFilesDigest(changedFiles),
  });
  const synthesis = parseSynthesisIdentityBinding(input.synthesisInput.parsed);
  for (const [field, actual, expected] of [
    ["baseSha", synthesis.selection.baseSha, baseSha],
    ["headSha", synthesis.selection.headSha, monolithic.sourceSha],
    [
      "changedFilesDigest",
      synthesis.selection.changedFilesDigest,
      changedFilesDigest(changedFiles),
    ],
    ["inventoryFileDigest", synthesis.selection.inventoryFileDigest, inventoryFileDigest],
  ] as const) {
    if (actual !== expected)
      throw new Error(`synthesis selection ${field} is not independently verified`);
  }
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
    if (synthesis.identity[field] !== identity[field]) {
      throw new Error(`synthesis identity ${field} is not independently verified`);
    }
  }
  const expectedSelectedCheckIds = createVerificationManifest(
    monolithic.profile,
    monolithic.injectedFailure === "none"
      ? {
          base: baseSha,
          head: monolithic.sourceSha,
          changedFiles,
        }
      : {},
  )
    .filter(({ applicable }) => applicable !== false)
    .map(({ id }) => id);
  assertSetEquality(
    synthesis.selection.selectedCheckIds,
    expectedSelectedCheckIds,
    "synthesis selected check IDs",
  );
  return { identity, synthesis };
}

export function createCiPerformanceObservation(
  input: CreateCiPerformanceObservationInput,
): Observation {
  const run = parseRun(input.run);
  const jobs = parseJobs(input.jobs);
  const sample = parsePerformanceSample(input.rawSample.parsed);
  const verification = parseVerificationReport(input.verification.parsed);
  const fastLane = parseFastLane(input.fastLane.parsed);
  const packageMetadata = parsePackageMetadata(input.packageMetadata);
  const executionSha = requiredString(input.executionSha, "source execution SHA");
  if (!/^[0-9a-f]{40}$/.test(executionSha))
    throw new Error("source execution SHA must be a 40-character SHA");
  if (run.name !== "CI" || run.status !== "completed")
    throw new Error("source workflow must be a completed CI run");
  const validateJob = exactJob(jobs, "validate");
  const validateConclusion = conclusion(validateJob.conclusion, "validate job conclusion");
  if (
    sample.measurementScope !== "validate-job" ||
    sample.runId !== String(run.id) ||
    sample.jobId !== "validate" ||
    sample.commitSha !== executionSha ||
    sample.retryAttempt !== run.run_attempt ||
    sample.conclusion !== validateConclusion
  ) {
    throw new Error("performance sample provenance does not match the source validate execution");
  }
  if (
    verification.provenance.commitSha !== executionSha ||
    verification.provenance.runId !== String(run.id) ||
    verification.provenance.runAttempt !== String(run.run_attempt) ||
    verification.profile !== sample.profile
  ) {
    throw new Error("verification provenance does not match the source validate execution");
  }
  const inventoryFileDigest = createHash("sha256").update(input.inventoryBytes).digest("hex");
  if (sample.inventoryDigest !== inventoryFileDigest) {
    throw new Error("performance sample inventory file digest does not match current-run evidence");
  }
  assertSetEquality(
    verification.checks.map(({ id }) => id),
    EXPECTED_CHECKS,
    "verification check IDs",
  );
  if (
    fastLane.schemaVersion !== "croco.test-lane-report/v2" ||
    fastLane.lane !== "fast" ||
    fastLane.status !== "passed" ||
    fastLane.diagnostics.length !== 0 ||
    fastLane.skippedFiles.length !== 0
  ) {
    throw new Error("fast-lane evidence is not a successful current-inventory attestation");
  }
  const commandIds = fastLane.commands.map(({ owner }) => `${owner}#test`);
  if (new Set(commandIds).size !== commandIds.length)
    throw new Error("fast-lane evidence contains duplicate cache task IDs");
  if (fastLane.commands.some(({ status }) => status !== "passed"))
    throw new Error("fast-lane evidence contains a failed command");

  const checkResults = verification.checks.map(checkResult);
  const securityResults = SECURITY_STEPS.map((contract) => securityResult(validateJob, contract));
  const failureClass = injectedFailure(sample);
  assertInjectedFailureEvidence(run.event, failureClass, checkResults, "monolithic verification");
  const blockingFailed = [...checkResults, ...securityResults].some(
    (result) => result.semantics === "blocking" && result.conclusion === "failure",
  );
  const blockingOutcome = blockingFailed ? "failure" : "success";
  const operationalFailure =
    validateConclusion === "cancelled" ||
    (validateConclusion === "failure" && blockingOutcome === "success") ||
    (validateConclusion === "success" && blockingOutcome === "failure");
  const turboVersion = requiredString(
    packageMetadata.devDependencies.turbo,
    "trusted Turbo version",
  );
  const experimentIdentity = createCacheableExperimentIdentity({
    commitSha: executionSha,
    runId: String(run.id),
    runAttempt: run.run_attempt,
    profile: sample.profile,
    runnerOs: sample.runnerOs,
    runnerArch: sample.runnerArch,
    runnerLabel: sample.runnerLabel,
    nodeVersion: sample.nodeVersion,
    pnpmVersion: sample.pnpmVersion,
    turboVersion,
    packageManager: packageMetadata.packageManager,
    workflowDigest: sample.workflowDigest,
    inventoryDigest: fastLane.inventoryDigest,
    inventoryFileDigest: sample.inventoryDigest,
  });
  const evidenceDigest = sha256([
    input.rawSample.bytes,
    input.verification.bytes,
    input.fastLane.bytes,
    input.inventoryBytes,
  ]);
  const diagnostics = [...checkResults, ...securityResults]
    .flatMap(({ diagnostics: entries }) => entries)
    .sort();
  if (operationalFailure) diagnostics.push(`validate-job:${validateConclusion}`);

  return parseObservation({
    schemaVersion: OBSERVATION_SCHEMA,
    sourceRunId: String(run.id),
    sourceAttempt: run.run_attempt,
    sourceCreatedAt: run.created_at,
    sourceCompletedAt: run.updated_at,
    sourceSha: executionSha,
    architectureVersion: "monolithic",
    jobIdentity: "validate",
    lane: "monolithic",
    artifactName: `ci-observation-${run.id}-${run.run_attempt}`,
    startedAt: validateJob.started_at,
    completedAt: validateJob.completed_at,
    conclusion: validateConclusion,
    blockingOutcome,
    operationalFailure,
    profile: sample.profile,
    runnerOs: sample.runnerOs,
    runnerArch: sample.runnerArch,
    runnerLabel: sample.runnerLabel,
    nodeVersion: sample.nodeVersion,
    pnpmVersion: sample.pnpmVersion,
    turboVersion,
    toolchainDigest: experimentIdentity.toolchainDigest,
    manifestDigest: experimentIdentity.manifestDigest,
    inventoryDigest: experimentIdentity.inventoryDigest,
    inputDigest: experimentIdentity.inputDigest,
    verificationExperimentId: experimentIdentity.verificationExperimentId,
    evidenceDigest,
    injectedFailure: failureClass,
    cacheEligibleTaskIds: commandIds,
    validCacheHitTaskIds: fastLane.commands.flatMap(({ owner, cacheStatus }) =>
      cacheStatus === "hit" ? [`${owner}#test`] : [],
    ),
    freshAttestation: sample.cacheEvidenceComplete,
    checkResults,
    securityResults,
    stableDiagnostics: diagnostics,
  });
}

function sourceJobConclusion(value: string | null, field: string): Observation["conclusion"] {
  if (value !== "success" && value !== "failure" && value !== "cancelled" && value !== "skipped") {
    throw new Error(`${field} must be success, failure, cancelled, or skipped`);
  }
  return value;
}

function producerObservationConclusion(
  jobConclusion: Observation["conclusion"],
  bundle: ProducerBundle,
): Observation["conclusion"] {
  if (bundle.status === "failure" && (jobConclusion === "success" || jobConclusion === "failure")) {
    return "failure";
  }
  return jobConclusion;
}

function operationalProducerFailure(
  jobConclusion: Observation["conclusion"],
  bundle: ProducerBundle,
): boolean {
  if (jobConclusion === "cancelled" || jobConclusion === "skipped") return true;
  if (bundle.status === "failure") return false;
  return jobConclusion !== "success";
}

function blockingOutcome(results: readonly ResultRecord[]): "success" | "failure" {
  return results.some(
    ({ conclusion: resultConclusionValue, semantics }) =>
      semantics === "blocking" && resultConclusionValue === "failure",
  )
    ? "failure"
    : "success";
}

function splitStableDiagnostics(
  results: readonly ResultRecord[],
  operationalDiagnostic?: string,
): readonly string[] {
  return [
    ...new Set([
      ...results.flatMap(({ diagnostics }) => diagnostics),
      ...(operationalDiagnostic ? [operationalDiagnostic] : []),
    ]),
  ].sort();
}

function assertProducerMatchesSynthesis(
  bundle: ProducerBundle,
  shadow: SplitValidationShadowEvidence,
): void {
  const synthesized = new Map(
    shadow.checks
      .filter(({ id }) => LANE_OWNERSHIP[bundle.lane].includes(id as never))
      .map((result) => [result.id, result]),
  );
  if (synthesized.size !== bundle.checks.length) {
    throw new Error(`${bundle.lane} synthesis check coverage is incomplete`);
  }
  for (const result of bundle.checks) {
    const expected = synthesized.get(result.id);
    if (
      !expected ||
      result.selection !== expected.selection ||
      result.semantics !== expected.semantics ||
      result.outcome !== expected.outcome ||
      JSON.stringify(result.diagnostics) !== JSON.stringify(expected.diagnostics)
    ) {
      throw new Error(`${bundle.lane} result ${result.id} does not match synthesis evidence`);
    }
  }
}

export function createCiPerformanceObservations(
  input: CreateCiPerformanceObservationInput,
): readonly Observation[] {
  let monolithic = createCiPerformanceObservation(input);
  const run = parseRun(input.run);
  const jobs = parseJobs(input.jobs);
  const hasProducerInput = input.producerBundles !== undefined;
  const hasShadowInput = input.splitValidationShadow !== undefined;
  const hasSecuritySummaryInput = input.splitSecuritySummary !== undefined;
  const splitEvidencePresent = hasProducerInput || hasShadowInput || hasSecuritySummaryInput;
  assertSplitArtifactSet(run, input.artifacts, splitEvidencePresent);

  const splitJobCount = SPLIT_JOB_IDENTITIES.reduce(
    (count, identity) => count + jobs.jobs.filter(({ name }) => name === identity).length,
    0,
  );
  if (!splitEvidencePresent && splitJobCount === 0) return [monolithic];
  if (!hasProducerInput || !hasShadowInput || !hasSecuritySummaryInput) {
    throw new Error(
      "Phase B observation requires four producer bundles, shadow evidence, and a security summary",
    );
  }
  if (splitJobCount !== SPLIT_JOB_IDENTITIES.length) {
    throw new Error(
      `Phase B source run must contain exactly five split jobs, found ${splitJobCount}`,
    );
  }
  if (input.producerBundles.length !== PRODUCER_LANES.length) {
    throw new Error(
      `Phase B observation requires exactly four producer bundles, found ${input.producerBundles.length}`,
    );
  }
  if (monolithic.profile !== "publish") {
    throw new Error("Phase B observations are restricted to the publish profile");
  }

  const bundles = input.producerBundles.map((evidence, index) =>
    parseProducerBundle(evidence.parsed, `producerBundles[${index}]`),
  );
  const verifiedPhaseB = independentlyVerifiedPhaseBIdentity(monolithic, input);
  monolithic = parseObservation({
    ...monolithic,
    toolchainDigest: verifiedPhaseB.identity.toolchainDigest,
    manifestDigest: verifiedPhaseB.identity.manifestDigest,
    inventoryDigest: verifiedPhaseB.identity.inventoryDigest,
    inputDigest: verifiedPhaseB.identity.inputDigest,
    verificationExperimentId: verifiedPhaseB.identity.verificationExperimentId,
  });
  const canonicalBundle = bundles[0];
  if (!canonicalBundle) throw new Error("Phase B producer bundles are missing");
  for (const [field, actual, expected] of [
    ["commitSha", canonicalBundle.commitSha, monolithic.sourceSha],
    ["runId", canonicalBundle.runId, monolithic.sourceRunId],
    ["runAttempt", canonicalBundle.runAttempt, monolithic.sourceAttempt],
    ["profile", canonicalBundle.profile, monolithic.profile],
    ["manifestDigest", canonicalBundle.manifestDigest, monolithic.manifestDigest],
    ["inventoryDigest", canonicalBundle.inventoryDigest, monolithic.inventoryDigest],
    ["toolchainDigest", canonicalBundle.toolchainDigest, monolithic.toolchainDigest],
    ["inputDigest", canonicalBundle.inputDigest, monolithic.inputDigest],
    [
      "verificationExperimentId",
      canonicalBundle.verificationExperimentId,
      monolithic.verificationExperimentId,
    ],
  ] as const) {
    if (actual !== expected) {
      throw new Error(`Phase B canonical producer ${field} does not match monolithic provenance`);
    }
  }
  const producerBytesByLane = new Map(
    bundles.map((bundle, index) => [bundle.lane, input.producerBundles?.[index]?.bytes]),
  );
  assertSetEquality(
    bundles.map(({ lane }) => lane),
    PRODUCER_LANES,
    "producer bundle lanes",
  );
  if (new Set(bundles.map(({ lane }) => lane)).size !== bundles.length) {
    throw new Error("producer bundles contain duplicate lanes");
  }
  const synthesisProducerDigests = new Map(
    verifiedPhaseB.synthesis.producers.map(({ lane, bundleDigest }) => [lane, bundleDigest]),
  );
  for (const bundle of bundles) {
    if (synthesisProducerDigests.get(bundle.lane) !== bundle.bundleDigest) {
      throw new Error(`${bundle.lane} producer digest does not match synthesis input`);
    }
  }
  const monolithicVerification = parseVerificationReport(input.verification.parsed);
  const producerBundleDigests = bundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest }));
  const shadow = parseSplitValidationShadowEvidence(
    input.splitValidationShadow.parsed,
    {
      architectureVersion: "shadow-split",
      commitSha: monolithic.sourceSha,
      runId: monolithic.sourceRunId,
      runAttempt: monolithic.sourceAttempt,
      profile: monolithic.profile,
      manifestDigest: monolithic.manifestDigest,
      inventoryDigest: monolithic.inventoryDigest,
      toolchainDigest: monolithic.toolchainDigest,
      inputDigest: monolithic.inputDigest,
      verificationExperimentId: monolithic.verificationExperimentId,
      selectedCheckIds: monolithicVerification.checks
        .filter(({ status }) => status !== "not_applicable")
        .map(({ id }) => id),
      producerBundleDigests,
    },
    "splitValidationShadow",
  );
  parseSplitSecuritySummary(input.splitSecuritySummary.parsed, shadow);
  for (const bundle of bundles) {
    assertSplitIdentity(monolithic, bundle, bundle.lane);
    assertProducerMatchesSynthesis(bundle, shadow);
  }
  assertSplitIdentity(monolithic, shadow, "split-validation-shadow");
  const expectedBundleDigests = producerBundleDigests.sort((left, right) =>
    left.lane.localeCompare(right.lane),
  );
  const shadowBundleDigests = [...shadow.producerBundles].sort((left, right) =>
    left.lane.localeCompare(right.lane),
  );
  if (JSON.stringify(expectedBundleDigests) !== JSON.stringify(shadowBundleDigests)) {
    throw new Error("split-validation-shadow does not bind the exact producer bundles");
  }

  const artifactName = `ci-observation-${run.id}-${run.run_attempt}`;
  const failureClass = monolithic.injectedFailure;
  assertInjectedFailureEvidence(
    run.event,
    failureClass,
    shadow.checks.map(splitResult),
    "split validation shadow",
  );
  const shadowJob = exactJob(jobs, "split-validation-shadow");
  const uploadStepConclusion = exactStepConclusion(
    shadowJob,
    "Upload split validation shadow evidence",
  );
  const uploadResult: ResultRecord = {
    id: "security-upload",
    conclusion: uploadStepConclusion === "success" ? "success" : "failure",
    semantics: "advisory",
    diagnostics:
      uploadStepConclusion === "success"
        ? []
        : [`security-upload:${uploadStepConclusion ?? "missing"}`],
  };
  const securityByOwner = (owner: string): readonly ResultRecord[] => {
    const evidenced = shadow.security
      .filter((result) => result.owner === owner && result.id !== "security-upload")
      .map(splitSecurityResult);
    if (owner !== "validate-synthesis") return evidenced;
    return [...evidenced, uploadResult];
  };
  const producerObservations = bundles.map((bundle): Observation => {
    const job = exactJob(jobs, bundle.lane);
    const jobConclusion = sourceJobConclusion(job.conclusion, `${bundle.lane} job conclusion`);
    const checkResults = bundle.checks.map(splitResult);
    const securityResults = securityByOwner(bundle.lane);
    const allResults = [...checkResults, ...securityResults];
    const operationalFailure = operationalProducerFailure(jobConclusion, bundle);
    const conclusion = producerObservationConclusion(jobConclusion, bundle);
    const cache = producerCacheEvidence(bundle);
    const producerBytes = producerBytesByLane.get(bundle.lane);
    if (!producerBytes) throw new Error(`${bundle.lane} evidence bytes are missing`);
    return parseObservation({
      schemaVersion: OBSERVATION_SCHEMA,
      sourceRunId: String(run.id),
      sourceAttempt: run.run_attempt,
      sourceCreatedAt: run.created_at,
      sourceCompletedAt: run.updated_at,
      sourceSha: monolithic.sourceSha,
      architectureVersion: "shadow-split",
      jobIdentity: bundle.lane,
      lane: bundle.lane,
      artifactName,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      conclusion,
      blockingOutcome: blockingOutcome(allResults),
      operationalFailure,
      profile: monolithic.profile,
      runnerOs: monolithic.runnerOs,
      runnerArch: monolithic.runnerArch,
      runnerLabel: monolithic.runnerLabel,
      nodeVersion: monolithic.nodeVersion,
      pnpmVersion: monolithic.pnpmVersion,
      turboVersion: monolithic.turboVersion,
      toolchainDigest: monolithic.toolchainDigest,
      manifestDigest: monolithic.manifestDigest,
      inventoryDigest: monolithic.inventoryDigest,
      inputDigest: monolithic.inputDigest,
      verificationExperimentId: monolithic.verificationExperimentId,
      evidenceDigest: sha256([producerBytes, input.splitValidationShadow.bytes]),
      injectedFailure: failureClass,
      cacheEligibleTaskIds: cache.eligible,
      validCacheHitTaskIds: cache.hits,
      freshAttestation: bundle.attestations.every(({ fresh }) => fresh),
      checkResults,
      securityResults,
      stableDiagnostics: splitStableDiagnostics(
        allResults,
        operationalFailure ? `${bundle.lane}-job:${jobConclusion}` : undefined,
      ),
    });
  });

  const shadowConclusion = sourceJobConclusion(
    shadowJob.conclusion,
    "split-validation-shadow job conclusion",
  );
  const synthesisOperationalFailure =
    shadow.operationalFailure !== null ||
    shadowConclusion === "cancelled" ||
    shadowConclusion === "skipped" ||
    (shadow.conclusion === "success" &&
      shadowConclusion !== "success" &&
      uploadResult.conclusion === "success");
  const synthesisConclusion = synthesisOperationalFailure ? shadowConclusion : shadow.conclusion;
  const synthesisCheckIds = LANE_OWNERSHIP["validate-synthesis"];
  const synthesisChecks = shadow.checks
    .filter(({ id }) => synthesisCheckIds.includes(id as never))
    .map(splitResult);
  const synthesisSecurity = securityByOwner("validate-synthesis");
  const synthesisResults = [...synthesisChecks, ...synthesisSecurity];
  const allCache = producerObservations.flatMap(({ cacheEligibleTaskIds }) => cacheEligibleTaskIds);
  const allHits = producerObservations.flatMap(({ validCacheHitTaskIds }) => validCacheHitTaskIds);
  const synthesisObservation = parseObservation({
    schemaVersion: OBSERVATION_SCHEMA,
    sourceRunId: String(run.id),
    sourceAttempt: run.run_attempt,
    sourceCreatedAt: run.created_at,
    sourceCompletedAt: run.updated_at,
    sourceSha: monolithic.sourceSha,
    architectureVersion: "shadow-split",
    jobIdentity: "split-validation-shadow",
    lane: "validate-synthesis",
    artifactName,
    startedAt: shadowJob.started_at,
    completedAt: shadowJob.completed_at,
    conclusion: synthesisConclusion,
    blockingOutcome: shadow.blockingOutcome === "passed" ? "success" : "failure",
    operationalFailure: synthesisOperationalFailure,
    profile: monolithic.profile,
    runnerOs: monolithic.runnerOs,
    runnerArch: monolithic.runnerArch,
    runnerLabel: monolithic.runnerLabel,
    nodeVersion: monolithic.nodeVersion,
    pnpmVersion: monolithic.pnpmVersion,
    turboVersion: monolithic.turboVersion,
    toolchainDigest: monolithic.toolchainDigest,
    manifestDigest: monolithic.manifestDigest,
    inventoryDigest: monolithic.inventoryDigest,
    inputDigest: monolithic.inputDigest,
    verificationExperimentId: monolithic.verificationExperimentId,
    evidenceDigest: sha256([
      input.splitValidationShadow.bytes,
      input.splitSecuritySummary.bytes,
      ...input.producerBundles.map(({ bytes }) => bytes),
    ]),
    injectedFailure: failureClass,
    cacheEligibleTaskIds: allCache,
    validCacheHitTaskIds: allHits,
    freshAttestation: shadow.fresh,
    checkResults: synthesisChecks,
    securityResults: synthesisSecurity,
    stableDiagnostics: splitStableDiagnostics(
      synthesisResults,
      shadow.operationalFailure ?? undefined,
    ),
  });

  const splitEvidenceDiagnostics = [...producerObservations, synthesisObservation]
    .flatMap(({ checkResults, securityResults }) => [...checkResults, ...securityResults])
    .filter(({ id }) => id !== "security-upload")
    .flatMap(({ diagnostics }) => diagnostics);
  const normalizedSplitEvidenceDiagnostics = [...new Set(splitEvidenceDiagnostics)].sort();
  const evidencedDiagnostics = splitStableDiagnostics(
    [...shadow.checks, ...shadow.security.filter(({ id }) => id !== "security-upload")],
    shadow.operationalFailure ?? undefined,
  ).sort();
  if (JSON.stringify(normalizedSplitEvidenceDiagnostics) !== JSON.stringify(evidencedDiagnostics)) {
    throw new Error("split observation diagnostics do not match shadow evidence");
  }
  return [monolithic, ...producerObservations, synthesisObservation];
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function optionValues(arguments_: readonly string[], name: string): readonly string[] {
  return arguments_.flatMap((argument, index) =>
    argument === name && arguments_[index + 1] ? [arguments_[index + 1] as string] : [],
  );
}

function requiredOption(arguments_: readonly string[], name: string): string {
  const value = optionValue(arguments_, name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
}

function readJsonBytes(path: string): { readonly bytes: Buffer; readonly parsed: unknown } {
  const bytes = readFileSync(resolve(path));
  return { bytes, parsed: JSON.parse(bytes.toString("utf8")) as unknown };
}

function main(arguments_: readonly string[]): void {
  const outputPath = resolve(requiredOption(arguments_, "--output"));
  const markdownPath = resolve(requiredOption(arguments_, "--markdown-output"));
  const artifactPath = optionValue(arguments_, "--artifacts");
  const producerPaths = optionValues(arguments_, "--producer-bundle");
  const shadowPath = optionValue(arguments_, "--split-validation-shadow");
  const splitSecuritySummaryPath = optionValue(arguments_, "--split-security-summary");
  const baseSha = optionValue(arguments_, "--base-sha");
  const sourceWorkflowPath = optionValue(arguments_, "--source-workflow");
  const synthesisInputPath = optionValue(arguments_, "--synthesis-input");
  const executionSha = requiredOption(arguments_, "--execution-sha");
  const observations = createCiPerformanceObservations({
    run: JSON.parse(readFileSync(resolve(requiredOption(arguments_, "--run")), "utf8")) as unknown,
    jobs: JSON.parse(
      readFileSync(resolve(requiredOption(arguments_, "--jobs")), "utf8"),
    ) as unknown,
    executionSha,
    rawSample: readJsonBytes(requiredOption(arguments_, "--sample")),
    verification: readJsonBytes(requiredOption(arguments_, "--verification")),
    fastLane: readJsonBytes(requiredOption(arguments_, "--fast-lane")),
    inventoryBytes: readFileSync(resolve(requiredOption(arguments_, "--inventory"))),
    packageMetadata: JSON.parse(
      readFileSync(resolve(requiredOption(arguments_, "--package-metadata")), "utf8"),
    ) as unknown,
    ...(artifactPath
      ? { artifacts: JSON.parse(readFileSync(resolve(artifactPath), "utf8")) as unknown }
      : {}),
    ...(producerPaths.length > 0
      ? { producerBundles: producerPaths.map((path) => readJsonBytes(path)) }
      : {}),
    ...(shadowPath ? { splitValidationShadow: readJsonBytes(shadowPath) } : {}),
    ...(splitSecuritySummaryPath
      ? { splitSecuritySummary: readJsonBytes(splitSecuritySummaryPath) }
      : {}),
    ...(baseSha
      ? { baseSha, changedFiles: readChangedFiles(process.cwd(), baseSha, executionSha) }
      : {}),
    ...(sourceWorkflowPath
      ? { sourceWorkflowBytes: readFileSync(resolve(sourceWorkflowPath)) }
      : {}),
    ...(synthesisInputPath ? { synthesisInput: readJsonBytes(synthesisInputPath) } : {}),
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  observations.forEach((observation, index) => {
    const path =
      index === 0
        ? outputPath
        : resolve(
            dirname(outputPath),
            `observation-${observation.architectureVersion}-${observation.jobIdentity}.json`,
          );
    writeFileSync(path, `${JSON.stringify(observation, null, 2)}\n`);
  });
  writeFileSync(
    markdownPath,
    [
      "# CI performance observation",
      "",
      `- Source run: ${observations[0]?.sourceRunId} (attempt ${observations[0]?.sourceAttempt})`,
      `- Immutable records: ${observations.length}`,
      ...observations.flatMap((observation) => [
        `- ${observation.architectureVersion}/${observation.jobIdentity}: ${observation.conclusion}`,
        `  - Queue-inclusive wall: ${(
          (Date.parse(observation.completedAt) - Date.parse(observation.sourceCreatedAt)) /
          60_000
        ).toFixed(2)} minutes`,
        `  - Execution duration: ${(
          (Date.parse(observation.completedAt) - Date.parse(observation.startedAt)) /
          60_000
        ).toFixed(2)} minutes`,
        `  - Cache task hits: ${observation.validCacheHitTaskIds.length}/${observation.cacheEligibleTaskIds.length}`,
      ]),
      "",
    ].join("\n"),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main(argv.slice(2));
  } catch (error) {
    console.error(
      `[ci-performance-observer] ${error instanceof Error ? error.message : String(error)}`,
    );
    exit(1);
  }
}
