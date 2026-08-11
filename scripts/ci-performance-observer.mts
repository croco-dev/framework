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

type PerformanceSample = {
  readonly measurementScope: "validate-job";
  readonly runId: string;
  readonly jobId: string;
  readonly commitSha: string;
  readonly profile: string;
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
};

const SECURITY_STEPS = [
  {
    id: "advisory-production-audit",
    name: "Production dependency audit report",
    semantics: "advisory",
  },
  {
    id: "gitleaks-acceptance-smoke",
    name: "Security Gitleaks acceptance smoke",
    semantics: "blocking",
  },
  { id: "blocking-secret-scan", name: "Secret scan blocking report", semantics: "blocking" },
  {
    id: "security-policy-summary",
    name: "Assemble security policy summary",
    semantics: "advisory",
  },
  { id: "security-upload", name: "Upload security report", semantics: "advisory" },
] as const satisfies readonly {
  readonly id: string;
  readonly name: string;
  readonly semantics: ResultRecord["semantics"];
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
  if (!isRecord(value) || !Array.isArray(value.commands) || !Array.isArray(value.diagnostics)) {
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
    semantics: contract.semantics,
    diagnostics:
      stepConclusion === "success" ? [] : [`${contract.id}:${stepConclusion ?? "missing"}`],
  };
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
  const validateJobs = jobs.jobs.filter(({ name }) => name === "validate");
  if (validateJobs.length !== 1)
    throw new Error(
      `source run must contain exactly one validate job, found ${validateJobs.length}`,
    );
  const validateJob = validateJobs[0];
  if (validateJob.status !== "completed" || validateJob.completed_at === null)
    throw new Error("validate job must be completed");
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
    fastLane.schemaVersion !== "croco.test-lane-report/v1" ||
    fastLane.lane !== "fast" ||
    fastLane.status !== "passed" ||
    fastLane.diagnostics.length !== 0
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
  const toolchainDigest = sha256([
    sample.runnerOs,
    sample.runnerArch,
    sample.runnerLabel,
    sample.nodeVersion,
    sample.pnpmVersion,
    turboVersion,
    packageMetadata.packageManager,
  ]);
  const inputDigest = sha256([
    executionSha,
    sample.workflowDigest,
    sample.inventoryDigest,
    toolchainDigest,
  ]);
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
    toolchainDigest,
    manifestDigest: sample.workflowDigest,
    inventoryDigest: fastLane.inventoryDigest,
    inputDigest,
    verificationExperimentId: `${run.id}-${run.run_attempt}-${inputDigest.slice(0, 12)}`,
    evidenceDigest,
    injectedFailure: "none",
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

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
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
  const observation = createCiPerformanceObservation({
    run: JSON.parse(readFileSync(resolve(requiredOption(arguments_, "--run")), "utf8")) as unknown,
    jobs: JSON.parse(
      readFileSync(resolve(requiredOption(arguments_, "--jobs")), "utf8"),
    ) as unknown,
    executionSha: requiredOption(arguments_, "--execution-sha"),
    rawSample: readJsonBytes(requiredOption(arguments_, "--sample")),
    verification: readJsonBytes(requiredOption(arguments_, "--verification")),
    fastLane: readJsonBytes(requiredOption(arguments_, "--fast-lane")),
    inventoryBytes: readFileSync(resolve(requiredOption(arguments_, "--inventory"))),
    packageMetadata: JSON.parse(
      readFileSync(resolve(requiredOption(arguments_, "--package-metadata")), "utf8"),
    ) as unknown,
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(observation, null, 2)}\n`);
  writeFileSync(
    markdownPath,
    [
      "# CI performance observation",
      "",
      `- Source run: ${observation.sourceRunId} (attempt ${observation.sourceAttempt})`,
      `- Validate conclusion: ${observation.conclusion}`,
      `- Queue-inclusive wall: ${(
        (Date.parse(observation.completedAt) - Date.parse(observation.sourceCreatedAt)) /
        60_000
      ).toFixed(2)} minutes`,
      `- Execution critical path: ${(
        (Date.parse(observation.completedAt) - Date.parse(observation.startedAt)) /
        60_000
      ).toFixed(2)} minutes`,
      `- Cache task hits: ${observation.validCacheHitTaskIds.length}/${observation.cacheEligibleTaskIds.length}`,
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
