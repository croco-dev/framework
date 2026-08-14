import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { LANE_OWNERSHIP, SECURITY_OWNERSHIP } from "../ci-cacheable-lanes-evaluator.mts";
import {
  PRODUCER_LANES,
  createCurrentRunAttestation,
  createProducerBundle,
  createReusableReceipt,
  createSplitValidationShadowEvidence,
  evidenceDigest,
  type EvidenceIdentity,
  type ProducerBundle,
} from "../ci-lane-evidence.mts";
import {
  createCiPerformanceObservation,
  createCiPerformanceObservations,
} from "../ci-performance-observer.mts";

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

const SPLIT_JOBS = PRODUCER_LANES.map((name, index) => ({
  id: 20 + index,
  name,
  status: "completed",
  conclusion: "success",
  started_at: `2026-08-14T00:0${3 + index}:00.000Z`,
  completed_at: `2026-08-14T00:${20 + index}:00.000Z`,
  steps: [],
}));

const PHASE_B_JOBS = {
  total_count: JOBS.total_count + SPLIT_JOBS.length + 1,
  jobs: [
    ...JOBS.jobs,
    ...SPLIT_JOBS,
    {
      id: 30,
      name: "split-validation-shadow",
      status: "completed",
      conclusion: "success",
      started_at: "2026-08-14T00:24:00.000Z",
      completed_at: "2026-08-14T00:32:00.000Z",
      steps: [],
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

function phaseBArtifacts(
  overrides: readonly { readonly name: string; readonly expired: boolean }[] = [],
) {
  const artifacts = [
    ...PRODUCER_LANES.map((lane) => ({ name: `ci-lane-${lane}-123-2`, expired: false })),
    { name: "ci-lane-split-validation-shadow-123-2", expired: false },
    ...overrides,
  ];
  return { total_count: artifacts.length, artifacts };
}

function phaseBInput(overrides: Readonly<Record<string, unknown>> = {}) {
  const monolithic = createCiPerformanceObservation(createInput());
  const sharedIdentity = {
    architectureVersion: "shadow-split",
    commitSha: monolithic.sourceSha,
    runId: monolithic.sourceRunId,
    runAttempt: monolithic.sourceAttempt,
    profile: "publish",
    manifestDigest: monolithic.manifestDigest,
    inventoryDigest: monolithic.inventoryDigest,
    toolchainDigest: monolithic.toolchainDigest,
    inputDigest: monolithic.inputDigest,
    verificationExperimentId: monolithic.verificationExperimentId,
  } as const satisfies Omit<EvidenceIdentity, "lane">;
  const bundles = PRODUCER_LANES.map((lane): ProducerBundle => {
    const startedAt = PHASE_B_JOBS.jobs.find(({ name }) => name === lane)?.started_at;
    const completedAt = PHASE_B_JOBS.jobs.find(({ name }) => name === lane)?.completed_at;
    if (!startedAt || !completedAt) throw new Error(`Missing ${lane} fixture job`);
    const receipts = LANE_OWNERSHIP[lane].map((checkId, index) =>
      createReusableReceipt({
        lane,
        checkId,
        profile: "publish",
        manifestDigest: sharedIdentity.manifestDigest,
        inventoryDigest: sharedIdentity.inventoryDigest,
        toolchainDigest: sharedIdentity.toolchainDigest,
        inputDigest: sharedIdentity.inputDigest,
        contentHash: (index + 1).toString(16).padStart(64, "0"),
        taskHash: (index + 101).toString(16).padStart(64, "0"),
        commandDigest: (index + 201).toString(16).padStart(64, "0"),
        cache: {
          origin: index === 0 ? "github-exact-key" : "executed",
          revalidated: true,
          policyDigest: null,
        },
        outputs: [
          {
            path: `ci-reports/cacheable-ci/${lane}/${checkId}.json`,
            digest: (index + 301).toString(16).padStart(64, "0"),
            bytes: 1,
          },
        ],
      }),
    );
    const attestations = receipts.map((receipt) =>
      createCurrentRunAttestation({
        commitSha: sharedIdentity.commitSha,
        runId: sharedIdentity.runId,
        runAttempt: sharedIdentity.runAttempt,
        profile: sharedIdentity.profile,
        lane,
        checkId: receipt.checkId,
        manifestDigest: sharedIdentity.manifestDigest,
        inventoryDigest: sharedIdentity.inventoryDigest,
        toolchainDigest: sharedIdentity.toolchainDigest,
        inputDigest: sharedIdentity.inputDigest,
        receiptDigest: receipt.receiptDigest,
        outputDigest: evidenceDigest(receipt.outputs),
        decision: "passed",
        diagnostics: [],
        issuedAt: completedAt,
      }),
    );
    return createProducerBundle({
      ...sharedIdentity,
      lane,
      startedAt,
      completedAt,
      status: "success",
      checks: receipts.map((receipt, index) => ({
        id: receipt.checkId,
        selection: "selected",
        semantics: receipt.checkId === "core-coverage-warning" ? "advisory" : "blocking",
        outcome: "passed",
        receiptDigest: receipt.receiptDigest,
        attestationDigest: attestations[index]?.attestationDigest ?? "",
        diagnostics: [],
      })),
      receipts,
      attestations,
      artifactFiles: [
        {
          path: `ci-reports/cacheable-ci/${lane}/result.json`,
          digest: "f".repeat(64),
          bytes: 1,
        },
      ],
    });
  });
  const shadow = createSplitValidationShadowEvidence({
    ...sharedIdentity,
    producerBundles: bundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest })),
    checks: Object.values(LANE_OWNERSHIP).flatMap((ids) =>
      ids.map((id) => ({
        id,
        selection: "selected" as const,
        semantics: id === "core-coverage-warning" ? ("advisory" as const) : ("blocking" as const),
        outcome: "passed" as const,
        diagnostics: [],
      })),
    ),
    security: SECURITY_OWNERSHIP.map(({ id, owner, semantics }) => ({
      id,
      owner,
      semantics,
      outcome: "passed" as const,
      diagnostics: [],
    })),
    conclusion: "success",
    operationalFailure: null,
    startedAt: "2026-08-14T00:24:00.000Z",
    completedAt: "2026-08-14T00:32:00.000Z",
    issuedAt: "2026-08-14T00:32:00.000Z",
  });
  return {
    ...createInput(),
    jobs: PHASE_B_JOBS,
    artifacts: phaseBArtifacts(),
    producerBundles: bundles.map((parsed) => jsonEvidence(parsed)),
    splitValidationShadow: jsonEvidence(shadow),
    ...overrides,
  };
}

function phaseBFailureInput() {
  const input = phaseBInput();
  const bundles = input.producerBundles.map(({ parsed }) => parsed as ProducerBundle);
  const generated = bundles.find(({ lane }) => lane === "generated-apps");
  if (!generated) throw new Error("Missing generated-apps fixture bundle");
  const failedId = "generated-app-smoke";
  const diagnostic = `${failedId}:synthetic failure`;
  const failedAttestation = createCurrentRunAttestation({
    commitSha: generated.commitSha,
    runId: generated.runId,
    runAttempt: generated.runAttempt,
    profile: generated.profile,
    lane: generated.lane,
    checkId: failedId,
    manifestDigest: generated.manifestDigest,
    inventoryDigest: generated.inventoryDigest,
    toolchainDigest: generated.toolchainDigest,
    inputDigest: generated.inputDigest,
    receiptDigest: null,
    outputDigest: null,
    decision: "failed",
    diagnostics: [diagnostic],
    issuedAt: generated.completedAt,
  });
  const failedGenerated = createProducerBundle({
    architectureVersion: generated.architectureVersion,
    commitSha: generated.commitSha,
    runId: generated.runId,
    runAttempt: generated.runAttempt,
    profile: generated.profile,
    lane: generated.lane,
    manifestDigest: generated.manifestDigest,
    inventoryDigest: generated.inventoryDigest,
    toolchainDigest: generated.toolchainDigest,
    inputDigest: generated.inputDigest,
    verificationExperimentId: generated.verificationExperimentId,
    startedAt: generated.startedAt,
    completedAt: generated.completedAt,
    status: "failure",
    checks: generated.checks.map((check) =>
      check.id === failedId
        ? {
            ...check,
            outcome: "failed",
            receiptDigest: null,
            attestationDigest: failedAttestation.attestationDigest,
            diagnostics: [diagnostic],
          }
        : check,
    ),
    receipts: generated.receipts.filter(({ checkId }) => checkId !== failedId),
    attestations: generated.attestations.map((attestation) =>
      attestation.checkId === failedId ? failedAttestation : attestation,
    ),
    artifactFiles: generated.artifact.files,
  });
  const failedBundles = bundles.map((bundle) =>
    bundle.lane === "generated-apps" ? failedGenerated : bundle,
  );
  const originalShadow = input.splitValidationShadow.parsed as ReturnType<
    typeof createSplitValidationShadowEvidence
  >;
  const failedShadow = createSplitValidationShadowEvidence({
    architectureVersion: originalShadow.architectureVersion,
    commitSha: originalShadow.commitSha,
    runId: originalShadow.runId,
    runAttempt: originalShadow.runAttempt,
    profile: originalShadow.profile,
    manifestDigest: originalShadow.manifestDigest,
    inventoryDigest: originalShadow.inventoryDigest,
    toolchainDigest: originalShadow.toolchainDigest,
    inputDigest: originalShadow.inputDigest,
    verificationExperimentId: originalShadow.verificationExperimentId,
    producerBundles: failedBundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest })),
    checks: originalShadow.checks.map((check) =>
      check.id === failedId ? { ...check, outcome: "failed", diagnostics: [diagnostic] } : check,
    ),
    security: originalShadow.security,
    conclusion: "failure",
    operationalFailure: null,
    startedAt: originalShadow.startedAt,
    completedAt: originalShadow.completedAt,
    issuedAt: originalShadow.issuedAt,
  });
  return {
    ...input,
    jobs: {
      ...PHASE_B_JOBS,
      jobs: PHASE_B_JOBS.jobs.map((job) =>
        job.name === "generated-apps" || job.name === "split-validation-shadow"
          ? { ...job, conclusion: "failure" }
          : job,
      ),
    },
    producerBundles: failedBundles.map((parsed) => jsonEvidence(parsed)),
    splitValidationShadow: jsonEvidence(failedShadow),
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

  it("preserves the Phase A monolithic-only observation contract", () => {
    const observations = createCiPerformanceObservations(
      createInput({ artifacts: { total_count: 0, artifacts: [] } }),
    );

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      architectureVersion: "monolithic",
      jobIdentity: "validate",
    });
  });

  it("emits the monolith and an exact five-record Phase B split observation", () => {
    const observations = createCiPerformanceObservations(phaseBInput());

    expect(observations).toHaveLength(6);
    expect(
      observations
        .filter(({ architectureVersion }) => architectureVersion === "shadow-split")
        .map(({ jobIdentity }) => jobIdentity)
        .sort(),
    ).toEqual([...PRODUCER_LANES, "split-validation-shadow"].sort());
    const synthesis = observations.find(
      ({ jobIdentity }) => jobIdentity === "split-validation-shadow",
    );
    expect(synthesis).toMatchObject({
      lane: "validate-synthesis",
      blockingOutcome: "success",
      operationalFailure: false,
      conclusion: "success",
    });
    expect(synthesis?.cacheEligibleTaskIds).toHaveLength(49);
    expect(synthesis?.validCacheHitTaskIds).toHaveLength(4);
  });

  it("records an evidenced producer failure as an actual non-operational outcome", () => {
    const observations = createCiPerformanceObservations(phaseBFailureInput());
    const producer = observations.find(({ jobIdentity }) => jobIdentity === "generated-apps");
    const synthesis = observations.find(
      ({ jobIdentity }) => jobIdentity === "split-validation-shadow",
    );

    expect(producer).toMatchObject({
      conclusion: "failure",
      blockingOutcome: "failure",
      operationalFailure: false,
      stableDiagnostics: ["generated-app-smoke:synthetic failure"],
    });
    expect(synthesis).toMatchObject({
      conclusion: "failure",
      blockingOutcome: "failure",
      operationalFailure: false,
      stableDiagnostics: [],
    });
  });

  it("rejects an incomplete five-record split job set", () => {
    const jobs = {
      total_count: PHASE_B_JOBS.total_count - 1,
      jobs: PHASE_B_JOBS.jobs.filter(({ name }) => name !== "generated-apps"),
    };
    expect(() => createCiPerformanceObservations(phaseBInput({ jobs }))).toThrow(
      /exactly five split jobs/,
    );
  });

  it.each([
    ["run", { runId: "999" }],
    ["attempt", { runAttempt: 1 }],
    ["SHA", { commitSha: "c".repeat(40) }],
  ])("rejects a producer bundle with mismatched %s provenance", (_label, mismatch) => {
    const input = phaseBInput();
    const producerBundles = input.producerBundles.map((evidence, index) =>
      index === 0 ? jsonEvidence({ ...evidence.parsed, ...mismatch }) : evidence,
    );
    expect(() => createCiPerformanceObservations({ ...input, producerBundles })).toThrow(
      /digest|identity|provenance|match|mismatch/i,
    );
  });

  it("rejects duplicate split artifacts", () => {
    const duplicate = { name: "ci-lane-core-verification-123-2", expired: false };
    expect(() =>
      createCiPerformanceObservations(phaseBInput({ artifacts: phaseBArtifacts([duplicate]) })),
    ).toThrow(/artifact names|duplicate/i);
  });

  it("rejects a failed split job whose normalized failure evidence is missing", () => {
    const input = phaseBInput();
    const failedJobs = {
      ...PHASE_B_JOBS,
      jobs: PHASE_B_JOBS.jobs.map((job) =>
        job.name === "generated-apps" ? { ...job, conclusion: "failure" } : job,
      ),
    };
    expect(() =>
      createCiPerformanceObservations({
        ...input,
        jobs: failedJobs,
        producerBundles: input.producerBundles.filter(
          (evidence) => (evidence.parsed as { readonly lane?: string }).lane !== "generated-apps",
        ),
      }),
    ).toThrow(/exactly four producer bundles/);
  });
});
