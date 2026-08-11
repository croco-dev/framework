import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { LANE_OWNERSHIP } from "../ci-cacheable-lanes-evaluator.mts";
import { createCiPerformanceObservation } from "../ci-performance-observer.mts";

const EXECUTION_SHA = "bf70515ee2d99a1e8d6bfc23d76c5b33f892b16f";
const INVENTORY_BYTES = Buffer.from('{"inventoryVersion":1}\n');
const INVENTORY_FILE_DIGEST = createHash("sha256").update(INVENTORY_BYTES).digest("hex");
const INVENTORY_MODEL_DIGEST = "a".repeat(64);
const RUN = {
  id: 123,
  run_attempt: 2,
  name: "CI",
  event: "pull_request",
  status: "completed",
  conclusion: "success",
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:34:00.000Z",
};
const SECURITY_STEP_NAMES = [
  "Production dependency audit report",
  "Security Gitleaks acceptance smoke",
  "Secret scan blocking report",
  "Assemble security policy summary",
  "Upload security report",
];
const JOBS = {
  total_count: 2,
  jobs: [
    {
      id: 10,
      name: "changes",
      status: "completed",
      conclusion: "success",
      started_at: "2026-08-14T00:00:30.000Z",
      completed_at: "2026-08-14T00:01:00.000Z",
      steps: [],
    },
    {
      id: 11,
      name: "validate",
      status: "completed",
      conclusion: "success",
      started_at: "2026-08-14T00:02:00.000Z",
      completed_at: "2026-08-14T00:33:00.000Z",
      steps: SECURITY_STEP_NAMES.map((name) => ({ name, conclusion: "success" })),
    },
  ],
};

function jsonEvidence(parsed: unknown) {
  return { bytes: Buffer.from(JSON.stringify(parsed)), parsed };
}

function rawSample(overrides: Readonly<Record<string, unknown>> = {}) {
  return jsonEvidence({
    schemaVersion: "croco.ci-performance-samples/v1",
    samples: [],
    currentSamples: [
      {
        measurementScope: "validate-job",
        runId: "123",
        jobId: "validate",
        commitSha: EXECUTION_SHA,
        profile: "publish",
        runnerOs: "Linux",
        runnerArch: "X64",
        runnerLabel: "ubuntu-latest",
        nodeVersion: "v22.23.1",
        pnpmVersion: "11.9.0",
        cacheEvidenceComplete: true,
        inventoryDigest: INVENTORY_FILE_DIGEST,
        workflowDigest: "b".repeat(64),
        componentConclusion: "success",
        conclusion: "success",
        retryAttempt: 2,
        ...overrides,
      },
    ],
  });
}

function verification(overrides: Readonly<Record<string, unknown>> = {}) {
  return jsonEvidence({
    schemaVersion: 1,
    profile: "publish",
    provenance: { commitSha: EXECUTION_SHA, runId: "123", runAttempt: "2" },
    checks: Object.values(LANE_OWNERSHIP)
      .flat()
      .map((id) => ({ id, status: "passed", errorCode: null, failureReason: null })),
    ...overrides,
  });
}

function fastLane(overrides: Readonly<Record<string, unknown>> = {}) {
  return jsonEvidence({
    schemaVersion: "croco.test-lane-report/v1",
    lane: "fast",
    status: "passed",
    inventoryDigest: INVENTORY_MODEL_DIGEST,
    diagnostics: [],
    commands: [
      { owner: "@croco/example", status: "passed", cacheStatus: "hit" },
      { owner: "repo:ci", status: "passed", cacheStatus: "miss" },
    ],
    ...overrides,
  });
}

function createInput(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    run: RUN,
    jobs: JOBS,
    executionSha: EXECUTION_SHA,
    rawSample: rawSample(),
    verification: verification(),
    fastLane: fastLane(),
    inventoryBytes: INVENTORY_BYTES,
    packageMetadata: { packageManager: "pnpm@11.9.0", devDependencies: { turbo: "2.10.2" } },
    ...overrides,
  };
}

describe("CI performance observer", () => {
  it("emits an exact monolithic attestation for timing, results, security, and cache reuse", () => {
    const observation = createCiPerformanceObservation(createInput());

    expect(observation).toMatchObject({
      schemaVersion: "croco.ci-cacheable-lanes-observation/v1",
      sourceRunId: "123",
      sourceAttempt: 2,
      sourceSha: EXECUTION_SHA,
      architectureVersion: "monolithic",
      jobIdentity: "validate",
      lane: "monolithic",
      conclusion: "success",
      blockingOutcome: "success",
      operationalFailure: false,
      profile: "publish",
      runnerOs: "Linux",
      runnerArch: "X64",
      runnerLabel: "ubuntu-latest",
      nodeVersion: "v22.23.1",
      pnpmVersion: "11.9.0",
      turboVersion: "2.10.2",
      cacheEligibleTaskIds: ["@croco/example#test", "repo:ci#test"],
      validCacheHitTaskIds: ["@croco/example#test"],
      freshAttestation: true,
      stableDiagnostics: [],
    });
    expect(observation.checkResults).toHaveLength(53);
    expect(observation.securityResults).toHaveLength(5);
    for (const digest of [
      observation.toolchainDigest,
      observation.manifestDigest,
      observation.inventoryDigest,
      observation.inputDigest,
      observation.evidenceDigest,
    ]) {
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("preserves blocking check failures and stable diagnostics without classifying them as operational", () => {
    const failedVerification = verification({
      checks: Object.values(LANE_OWNERSHIP)
        .flat()
        .map((id) =>
          id === "generated-app-smoke"
            ? {
                id,
                status: "failed",
                errorCode: null,
                failureReason: "Command exited with status 1.",
              }
            : { id, status: "passed", errorCode: null, failureReason: null },
        ),
    });
    const failedJobs = {
      ...JOBS,
      jobs: JOBS.jobs.map((job) =>
        job.name === "validate" ? { ...job, conclusion: "failure" } : job,
      ),
    };
    const observation = createCiPerformanceObservation(
      createInput({
        jobs: failedJobs,
        rawSample: rawSample({ conclusion: "failure", componentConclusion: "failure" }),
        verification: failedVerification,
      }),
    );

    expect(observation).toMatchObject({
      conclusion: "failure",
      blockingOutcome: "failure",
      operationalFailure: false,
    });
    expect(observation.stableDiagnostics).toEqual([
      "generated-app-smoke:Command exited with status 1.",
    ]);
  });

  it("classifies a validate failure without a blocking result as operational", () => {
    const failedJobs = {
      ...JOBS,
      jobs: JOBS.jobs.map((job) =>
        job.name === "validate" ? { ...job, conclusion: "failure" } : job,
      ),
    };
    const observation = createCiPerformanceObservation(
      createInput({
        jobs: failedJobs,
        rawSample: rawSample({ conclusion: "failure", componentConclusion: "success" }),
      }),
    );

    expect(observation).toMatchObject({
      conclusion: "failure",
      blockingOutcome: "success",
      operationalFailure: true,
      stableDiagnostics: ["validate-job:failure"],
    });
  });

  it.each([
    ["run id", rawSample({ runId: "999" })],
    ["commit", rawSample({ commitSha: "c".repeat(40) })],
    ["attempt", rawSample({ retryAttempt: 1 })],
    ["job", rawSample({ jobId: "other" })],
  ])("rejects performance evidence with mismatched %s provenance", (_label, sample) => {
    expect(() => createCiPerformanceObservation(createInput({ rawSample: sample }))).toThrow(
      /provenance/,
    );
  });

  it("rejects omitted checks, stale inventory, duplicate cache tasks, and incomplete job pagination", () => {
    const allChecks = Object.values(LANE_OWNERSHIP).flat();
    expect(() =>
      createCiPerformanceObservation(
        createInput({
          verification: verification({
            checks: allChecks.slice(1).map((id) => ({
              id,
              status: "passed",
              errorCode: null,
              failureReason: null,
            })),
          }),
        }),
      ),
    ).toThrow(/check IDs/);
    expect(() =>
      createCiPerformanceObservation(
        createInput({ rawSample: rawSample({ inventoryDigest: "d".repeat(64) }) }),
      ),
    ).toThrow(/inventory file digest/);
    expect(() =>
      createCiPerformanceObservation(
        createInput({
          fastLane: fastLane({
            commands: [
              { owner: "repo:ci", status: "passed" },
              { owner: "repo:ci", status: "passed" },
            ],
          }),
        }),
      ),
    ).toThrow(/duplicate cache task/);
    expect(() =>
      createCiPerformanceObservation(
        createInput({ jobs: { ...JOBS, total_count: JOBS.total_count + 1 } }),
      ),
    ).toThrow(/incomplete/);
  });

  it("rejects a missing workflow-security responsibility", () => {
    const jobs = {
      ...JOBS,
      jobs: JOBS.jobs.map((job) =>
        job.name === "validate" ? { ...job, steps: job.steps.slice(1) } : job,
      ),
    };
    expect(() => createCiPerformanceObservation(createInput({ jobs }))).toThrow(
      /Production dependency audit report/,
    );
  });
});
