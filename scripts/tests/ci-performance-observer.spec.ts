import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { LANE_OWNERSHIP, SECURITY_OWNERSHIP } from "../ci-cacheable-lanes-evaluator.mts";
import {
  changedFilesDigest,
  createCacheableExperimentIdentity,
} from "../ci-cacheable-experiment-identity.mts";
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
import { inventoryDigest, parseStrictTestInventory } from "../test-inventory.mts";
import { createVerificationManifest } from "../verification-manifest.mts";

const EXECUTION_SHA = "bf70515ee2d99a1e8d6bfc23d76c5b33f892b16f";
const BASE_SHA = "d".repeat(40);
const CHANGED_FILES: readonly string[] = [];
const SOURCE_WORKFLOW_BYTES = Buffer.from("name: CI\n");
const SOURCE_WORKFLOW_DIGEST = createHash("sha256").update(SOURCE_WORKFLOW_BYTES).digest("hex");
const INVENTORY_BYTES = Buffer.from('{"version":1,"tests":[],"exceptions":[]}\n');
const INVENTORY_FILE_DIGEST = createHash("sha256").update(INVENTORY_BYTES).digest("hex");
const INVENTORY_MODEL_DIGEST = inventoryDigest(
  parseStrictTestInventory(JSON.parse(INVENTORY_BYTES.toString("utf8")) as unknown),
);
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
      steps: [{ name: "Upload split validation shadow evidence", conclusion: "success" }],
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
        workflowDigest: SOURCE_WORKFLOW_DIGEST,
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
  const sharedIdentity = createCacheableExperimentIdentity({
    commitSha: monolithic.sourceSha,
    runId: monolithic.sourceRunId,
    runAttempt: monolithic.sourceAttempt,
    profile: "publish",
    runnerOs: monolithic.runnerOs,
    runnerArch: monolithic.runnerArch,
    runnerLabel: monolithic.runnerLabel,
    nodeVersion: monolithic.nodeVersion,
    pnpmVersion: monolithic.pnpmVersion,
    turboVersion: monolithic.turboVersion,
    packageManager: "pnpm@11.9.0",
    workflowDigest: SOURCE_WORKFLOW_DIGEST,
    inventoryDigest: INVENTORY_MODEL_DIGEST,
    inventoryFileDigest: INVENTORY_FILE_DIGEST,
    baseSha: BASE_SHA,
    changedFilesDigest: changedFilesDigest(CHANGED_FILES),
  }) satisfies Omit<EvidenceIdentity, "lane">;
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
      checks: receipts.map((receipt, index) => {
        const attestation = attestations[index];
        if (!attestation) throw new Error(`Missing attestation fixture at index ${index}.`);
        return {
          id: receipt.checkId,
          selection: "selected",
          semantics: receipt.checkId === "core-coverage-warning" ? "advisory" : "blocking",
          outcome: "passed",
          receiptDigest: receipt.receiptDigest,
          attestationDigest: attestation.attestationDigest,
          diagnostics: [],
        };
      }),
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
      outcome: id === "security-upload" ? ("not-applicable" as const) : ("passed" as const),
      diagnostics:
        id === "security-upload" ? ["HOSTED_TRANSPORT_NOT_OBSERVED"] : ([] as readonly string[]),
    })),
    conclusion: "success",
    operationalFailure: null,
    startedAt: "2026-08-14T00:24:00.000Z",
    completedAt: "2026-08-14T00:32:00.000Z",
    issuedAt: "2026-08-14T00:32:00.000Z",
  });
  const unsignedSynthesisInput = {
    schemaVersion: "croco.ci-synthesis-input/v1",
    identity: sharedIdentity,
    selection: {
      baseSha: BASE_SHA,
      headSha: EXECUTION_SHA,
      changedFilesDigest: changedFilesDigest(CHANGED_FILES),
      inventoryFileDigest: INVENTORY_FILE_DIGEST,
      selectedCheckIds: createVerificationManifest("publish", {
        base: BASE_SHA,
        head: EXECUTION_SHA,
        changedFiles: CHANGED_FILES,
      })
        .filter(({ applicable }) => applicable !== false)
        .map(({ id }) => id),
    },
    producers: bundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest })),
    producerResults: [],
    facts: {},
    synthesisPlan: [],
  };
  const synthesisInput = {
    ...unsignedSynthesisInput,
    synthesisInputDigest: evidenceDigest(unsignedSynthesisInput),
  };
  return {
    ...createInput(),
    jobs: PHASE_B_JOBS,
    artifacts: phaseBArtifacts(),
    producerBundles: bundles.map((parsed) => jsonEvidence(parsed)),
    baseSha: BASE_SHA,
    changedFiles: CHANGED_FILES,
    sourceWorkflowBytes: SOURCE_WORKFLOW_BYTES,
    synthesisInput: jsonEvidence(synthesisInput),
    splitValidationShadow: jsonEvidence(shadow),
    splitSecuritySummary: jsonEvidence({
      schemaVersion: "croco.ci-split-security-policy-summary/v1",
      generatedAt: shadow.completedAt,
      results: shadow.security.filter(({ owner }) => owner === "coverage-security"),
    }),
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
  const synthesisInput = signedSynthesisInput(input, (unsigned) => ({
    ...unsigned,
    producers: failedBundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest })),
  }));
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
    synthesisInput,
    splitValidationShadow: jsonEvidence(failedShadow),
  };
}

function signedSynthesisInput(
  input: ReturnType<typeof phaseBInput>,
  mutate: (unsigned: Record<string, unknown>) => Record<string, unknown>,
) {
  const current = input.synthesisInput.parsed as Record<string, unknown>;
  const unsigned = mutate(
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== "synthesisInputDigest")),
  );
  return jsonEvidence({ ...unsigned, synthesisInputDigest: evidenceDigest(unsigned) });
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
    expect(synthesis?.securityResults).toContainEqual({
      id: "security-upload",
      conclusion: "success",
      semantics: "advisory",
      diagnostics: [],
    });
  });

  it("derives split security blocking semantics from the ownership contract", () => {
    const input = phaseBInput();
    const original = input.splitValidationShadow.parsed as ReturnType<
      typeof createSplitValidationShadowEvidence
    >;
    const failedShadow = createSplitValidationShadowEvidence({
      architectureVersion: original.architectureVersion,
      commitSha: original.commitSha,
      runId: original.runId,
      runAttempt: original.runAttempt,
      profile: original.profile,
      manifestDigest: original.manifestDigest,
      inventoryDigest: original.inventoryDigest,
      toolchainDigest: original.toolchainDigest,
      inputDigest: original.inputDigest,
      verificationExperimentId: original.verificationExperimentId,
      producerBundles: original.producerBundles,
      checks: original.checks,
      security: original.security.map((result) =>
        result.id === "gitleaks-acceptance-smoke"
          ? { ...result, outcome: "failed", diagnostics: ["acceptance-smoke:failed"] }
          : result,
      ),
      conclusion: "success",
      operationalFailure: null,
      startedAt: original.startedAt,
      completedAt: original.completedAt,
      issuedAt: original.issuedAt,
    });
    const observations = createCiPerformanceObservations({
      ...input,
      splitValidationShadow: jsonEvidence(failedShadow),
      splitSecuritySummary: jsonEvidence({
        schemaVersion: "croco.ci-split-security-policy-summary/v1",
        generatedAt: failedShadow.completedAt,
        results: failedShadow.security.filter(({ owner }) => owner === "coverage-security"),
      }),
    });
    const coverage = observations.find(({ jobIdentity }) => jobIdentity === "coverage-security");

    expect(coverage?.securityResults).toContainEqual({
      id: "gitleaks-acceptance-smoke",
      conclusion: "failure",
      semantics: "blocking",
      diagnostics: ["acceptance-smoke:failed"],
    });
    expect(coverage?.blockingOutcome).toBe("failure");
  });

  it("rejects a source workflow that does not match the observed workflow digest", () => {
    expect(() =>
      createCiPerformanceObservations(
        phaseBInput({ sourceWorkflowBytes: Buffer.from("name: forged\n") }),
      ),
    ).toThrow(/source workflow bytes/);
  });

  it("rejects changed files that do not match the synthesis-bound source range", () => {
    expect(() =>
      createCiPerformanceObservations(phaseBInput({ changedFiles: ["forged-change.ts"] })),
    ).toThrow(/selection changedFilesDigest is not independently verified/);
  });

  it("fails closed when a split run has no trusted base contract", () => {
    expect(() => createCiPerformanceObservations(phaseBInput({ baseSha: undefined }))).toThrow(
      /trusted base SHA/,
    );
  });

  it("rejects a re-signed synthesis selection that changes the trusted base", () => {
    const input = phaseBInput();
    const synthesisInput = signedSynthesisInput(input, (unsigned) => ({
      ...unsigned,
      selection: {
        ...(unsigned.selection as Record<string, unknown>),
        baseSha: "c".repeat(40),
      },
    }));

    expect(() => createCiPerformanceObservations({ ...input, synthesisInput })).toThrow(
      /selection baseSha is not independently verified/,
    );
  });

  it("rejects a re-signed synthesis identity instead of adopting its input digest", () => {
    const input = phaseBInput();
    const forgedInputDigest = "8".repeat(64);
    const synthesisInput = signedSynthesisInput(input, (unsigned) => ({
      ...unsigned,
      identity: {
        ...(unsigned.identity as Record<string, unknown>),
        inputDigest: forgedInputDigest,
        verificationExperimentId: `123-2-${forgedInputDigest.slice(0, 12)}`,
      },
    }));

    expect(() => createCiPerformanceObservations({ ...input, synthesisInput })).toThrow(
      /identity inputDigest is not independently verified/,
    );
  });

  it("rejects a re-signed synthesis input that substitutes a producer bundle digest", () => {
    const input = phaseBInput();
    const synthesisInput = signedSynthesisInput(input, (unsigned) => ({
      ...unsigned,
      producers: (unsigned.producers as readonly Record<string, unknown>[]).map((producer, index) =>
        index === 0 ? { ...producer, bundleDigest: "9".repeat(64) } : producer,
      ),
    }));

    expect(() => createCiPerformanceObservations({ ...input, synthesisInput })).toThrow(
      /producer digest does not match synthesis input/,
    );
  });

  it("records an evidenced producer failure as an actual non-operational outcome", () => {
    const input = phaseBFailureInput();
    const maskedJobs = {
      ...PHASE_B_JOBS,
      jobs: PHASE_B_JOBS.jobs.map((job) =>
        job.name === "generated-apps" || job.name === "split-validation-shadow"
          ? { ...job, conclusion: "success" }
          : job,
      ),
    };
    const observations = createCiPerformanceObservations({ ...input, jobs: maskedJobs });
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

  it("marks a failed advisory job with successful evidence as operational", () => {
    const input = phaseBInput();
    const jobs = {
      ...PHASE_B_JOBS,
      jobs: PHASE_B_JOBS.jobs.map((job) =>
        job.name === "generated-apps" ? { ...job, conclusion: "failure" } : job,
      ),
    };
    const observations = createCiPerformanceObservations({ ...input, jobs });
    const producer = observations.find(({ jobIdentity }) => jobIdentity === "generated-apps");

    expect(producer).toMatchObject({
      conclusion: "failure",
      blockingOutcome: "success",
      operationalFailure: true,
      stableDiagnostics: ["generated-apps-job:failure"],
    });
  });

  it("records a failed split evidence upload as an advisory result", () => {
    const input = phaseBInput();
    const jobs = {
      ...PHASE_B_JOBS,
      jobs: PHASE_B_JOBS.jobs.map((job) =>
        job.name === "split-validation-shadow"
          ? {
              ...job,
              conclusion: "success",
              steps: [{ name: "Upload split validation shadow evidence", conclusion: "failure" }],
            }
          : job,
      ),
    };
    const observations = createCiPerformanceObservations({ ...input, jobs });
    const synthesis = observations.find(
      ({ jobIdentity }) => jobIdentity === "split-validation-shadow",
    );

    expect(synthesis).toMatchObject({
      conclusion: "success",
      blockingOutcome: "success",
      operationalFailure: false,
    });
    expect(synthesis?.securityResults).toContainEqual({
      id: "security-upload",
      conclusion: "failure",
      semantics: "advisory",
      diagnostics: ["security-upload:failure"],
    });
  });

  it("rejects missing or mutated split security summary evidence", () => {
    const input = phaseBInput();
    expect(() =>
      createCiPerformanceObservations({ ...input, splitSecuritySummary: undefined }),
    ).toThrow(/security summary/);
    expect(() =>
      createCiPerformanceObservations({
        ...input,
        splitSecuritySummary: jsonEvidence({
          ...(input.splitSecuritySummary.parsed as Readonly<Record<string, unknown>>),
          generatedAt: "2026-08-14T00:31:59.000Z",
        }),
      }),
    ).toThrow(/timestamp/);
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
    ["run", { runId: "999" }, "artifact.name does not match lane/run/attempt"],
    ["attempt", { runAttempt: 1 }, "artifact.name does not match lane/run/attempt"],
    ["SHA", { commitSha: "c".repeat(40) }, "mismatches commitSha"],
  ])("rejects a producer bundle with mismatched %s provenance", (_label, mismatch, message) => {
    const input = phaseBInput();
    const producerBundles = input.producerBundles.map((evidence, index) =>
      index === 0 ? jsonEvidence({ ...evidence.parsed, ...mismatch }) : evidence,
    );
    expect(() => createCiPerformanceObservations({ ...input, producerBundles })).toThrow(message);
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
