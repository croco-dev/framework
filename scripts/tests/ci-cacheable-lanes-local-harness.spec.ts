import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { LANE_OWNERSHIP, SECURITY_OWNERSHIP } from "../ci-cacheable-lanes-evaluator.mts";
import {
  createCurrentRunAttestation,
  createProducerBundle,
  createReusableReceipt,
  createSplitValidationShadowEvidence,
  evidenceDigest,
  PRODUCER_LANES,
} from "../ci-lane-evidence.mts";
import {
  evaluateLocalEquivalence,
  LOCAL_EQUIVALENCE_REPORT_SCHEMA,
  runLocalEquivalenceCli,
} from "../ci-cacheable-lanes-local-harness.mts";
import type {
  CurrentRunAttestation,
  EvidenceIdentity,
  ProducerBundle,
  ProducerCheckResult,
  ProducerLane,
  ReusableReceipt,
  SynthesisCheckResult,
  SynthesisSecurityResult,
} from "../ci-lane-evidence.mts";
import type {
  EvidenceCheckResult,
  EvidenceStatus,
  ReleaseSpineEvidenceReport,
} from "../release-spine-evidence.mts";

const SHA = "a".repeat(40);
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const STARTED_AT = "2026-08-14T01:00:00.000Z";
const ISSUED_AT = "2026-08-14T01:05:00.000Z";
const COMPLETED_AT = "2026-08-14T01:10:00.000Z";

const identity = {
  architectureVersion: "shadow-split",
  commitSha: SHA,
  runId: "123456",
  runAttempt: 1,
  profile: "publish",
  manifestDigest: DIGEST_A,
  inventoryDigest: DIGEST_A,
  toolchainDigest: DIGEST_A,
  inputDigest: DIGEST_A,
  verificationExperimentId: "123456/1/publish/none",
} as const;

const allCheckIds = Object.values(LANE_OWNERSHIP).flat();

function output(lane: ProducerLane, checkId: string) {
  return {
    path: `ci-reports/split-evidence/${lane}/checks/${checkId}.json`,
    digest: DIGEST_B,
    bytes: 42,
  } as const;
}

function receipt(
  lane: ProducerLane,
  checkId: string,
  experiment: Omit<EvidenceIdentity, "lane"> = identity,
): ReusableReceipt {
  return createReusableReceipt({
    lane,
    checkId,
    profile: experiment.profile,
    manifestDigest: experiment.manifestDigest,
    inventoryDigest: experiment.inventoryDigest,
    toolchainDigest: experiment.toolchainDigest,
    inputDigest: experiment.inputDigest,
    contentHash: DIGEST_A,
    taskHash: DIGEST_A,
    commandDigest: DIGEST_A,
    cache: { origin: "executed", revalidated: true, policyDigest: null },
    outputs: [output(lane, checkId)],
  });
}

function attestation(
  lane: ProducerLane,
  checkId: string,
  checkReceipt: ReusableReceipt,
  experiment: Omit<EvidenceIdentity, "lane">,
): CurrentRunAttestation {
  return createCurrentRunAttestation({
    commitSha: experiment.commitSha,
    runId: experiment.runId,
    runAttempt: experiment.runAttempt,
    profile: experiment.profile,
    lane,
    checkId,
    manifestDigest: experiment.manifestDigest,
    inventoryDigest: experiment.inventoryDigest,
    toolchainDigest: experiment.toolchainDigest,
    inputDigest: experiment.inputDigest,
    receiptDigest: checkReceipt.receiptDigest,
    outputDigest: evidenceDigest(checkReceipt.outputs),
    decision: "passed",
    diagnostics: [],
    issuedAt: ISSUED_AT,
  });
}

function bundle(
  lane: ProducerLane,
  experiment: Omit<EvidenceIdentity, "lane"> = identity,
): ProducerBundle {
  const receipts: ReusableReceipt[] = [];
  const attestations: CurrentRunAttestation[] = [];
  const checks: ProducerCheckResult[] = [];
  for (const checkId of LANE_OWNERSHIP[lane]) {
    const checkReceipt = receipt(lane, checkId, experiment);
    const checkAttestation = attestation(lane, checkId, checkReceipt, experiment);
    receipts.push(checkReceipt);
    attestations.push(checkAttestation);
    checks.push({
      id: checkId,
      selection: "selected",
      semantics: checkId === "core-coverage-warning" ? "advisory" : "blocking",
      outcome: "passed",
      receiptDigest: checkReceipt.receiptDigest,
      attestationDigest: checkAttestation.attestationDigest,
      diagnostics: [],
    });
  }
  return createProducerBundle({
    ...experiment,
    lane,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    status: "success",
    checks,
    receipts,
    attestations,
    artifactFiles: [
      {
        path: `ci-reports/split-evidence/${lane}/manifest.json`,
        digest: evidenceDigest(checks),
        bytes: 512,
      },
    ],
  });
}

function shadow(
  bundles: readonly ProducerBundle[],
  overrides: Readonly<Record<string, Partial<SynthesisCheckResult>>> = {},
  securityOverrides: Readonly<Record<string, Partial<SynthesisSecurityResult>>> = {},
) {
  const checks: SynthesisCheckResult[] = allCheckIds.map((id) => ({
    id,
    selection: "selected",
    semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
    outcome: "passed",
    diagnostics: [],
    ...overrides[id],
  }));
  return createSplitValidationShadowEvidence({
    ...identity,
    producerBundles: bundles.map(({ lane, bundleDigest }) => ({ lane, bundleDigest })),
    checks,
    security: SECURITY_OWNERSHIP.map((entry) => ({
      ...entry,
      outcome: "passed" as const,
      diagnostics: [],
      ...securityOverrides[entry.id],
    })),
    conclusion:
      checks.some(({ outcome, semantics }) => outcome === "failed" && semantics === "blocking") ||
      SECURITY_OWNERSHIP.some(
        (entry) =>
          entry.semantics === "blocking" && securityOverrides[entry.id]?.outcome === "failed",
      )
        ? "failure"
        : "success",
    operationalFailure: null,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    issuedAt: ISSUED_AT,
  });
}

function check(id: string, status: EvidenceStatus = "passed"): EvidenceCheckResult {
  return {
    id,
    label: id,
    category: "quality",
    command: ["pnpm", id],
    timeoutMs: 60_000,
    artifacts: [],
    completedAt: COMPLETED_AT,
    durationMs: 1,
    effectiveTimeoutMs: 60_000,
    errorCode: null,
    errorMessage: null,
    exitCode: status === "passed" ? 0 : 1,
    failureReason: status === "passed" || status === "not_applicable" ? null : "fixture failure",
    signal: null,
    startedAt: STARTED_AT,
    status,
    stderrExcerpt: "",
    stdoutExcerpt: "",
  };
}

function monolithic(): ReleaseSpineEvidenceReport {
  const checks = allCheckIds.map((id) => check(id));
  return {
    schemaVersion: 1,
    completedAt: COMPLETED_AT,
    generatedAt: COMPLETED_AT,
    outputDir: "ci-reports/release",
    profile: identity.profile,
    provenance: {
      commitSha: identity.commitSha,
      runAttempt: String(identity.runAttempt),
      runId: identity.runId,
    },
    rootDir: "/workspace",
    status: "passed",
    summary: {
      failed: 0,
      interrupted: 0,
      notApplicable: 0,
      passed: checks.length,
      pending: 0,
      running: 0,
      skippedAfterTimeout: 0,
      skippedPrerequisite: 0,
      timedOut: 0,
      total: checks.length,
    },
    totalTimeoutMs: 9_000_000,
    checks,
  };
}

function fixture() {
  const producerBundles = PRODUCER_LANES.map((lane) => bundle(lane));
  const monolithicSecurity = SECURITY_OWNERSHIP.map((entry) => ({
    ...entry,
    outcome: "passed" as const,
    diagnostics: [],
  }));
  return {
    identity,
    monolithic: monolithic(),
    monolithicSecurity,
    producerBundles,
    splitValidationShadow: shadow(producerBundles),
  };
}

describe("local monolith versus split verification harness", () => {
  it("accepts one exact 53-check pair and leaves hosted-only metrics unmeasured", () => {
    const report = evaluateLocalEquivalence(fixture());

    expect(report).toMatchObject({
      schemaVersion: LOCAL_EQUIVALENCE_REPORT_SCHEMA,
      status: "passed",
      comparedCheckCount: 53,
      comparedSecurityCount: 4,
      monolithicBlockingOutcome: "passed",
      splitBlockingOutcome: "passed",
      mismatches: [],
      hostedOnlyMetrics: {
        queueInclusiveP95: "not-measured",
        runnerScheduling: "not-measured",
        artifactService: "not-measured",
      },
    });
  });

  it("rejects a missing producer lane", () => {
    const value = fixture();
    expect(() =>
      evaluateLocalEquivalence({ ...value, producerBundles: value.producerBundles.slice(0, 3) }),
    ).toThrow(/missing producer lane/i);
  });

  it("rejects a duplicate producer lane", () => {
    const value = fixture();
    expect(() =>
      evaluateLocalEquivalence({
        ...value,
        producerBundles: [
          value.producerBundles[0],
          value.producerBundles[0],
          value.producerBundles[1],
          value.producerBundles[2],
        ],
      }),
    ).toThrow(/duplicates/i);
  });

  it.each([
    ["commitSha", "c".repeat(40), /commitSha/i],
    ["profile", "repo", /profile/i],
    ["manifestDigest", DIGEST_B, /manifestDigest/i],
    ["verificationExperimentId", "different-experiment", /verificationExperimentId/i],
  ] as const)("rejects %s identity mismatch", (field, changed, message) => {
    const value = fixture();
    expect(() =>
      evaluateLocalEquivalence({
        ...value,
        identity: { ...identity, [field]: changed },
      }),
    ).toThrow(message);
  });

  it("reports a blocking outcome drift", () => {
    const value = fixture();
    const changedShadow = shadow(value.producerBundles, {
      "spine-promotion": { outcome: "failed", diagnostics: ["INJECTED_FAILURE"] },
    });

    const report = evaluateLocalEquivalence({ ...value, splitValidationShadow: changedShadow });

    expect(report.status).toBe("failed");
    expect(report.mismatches.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["BLOCKING_OUTCOME_MISMATCH", "CHECK_OUTCOME_MISMATCH"]),
    );
  });

  it("reports stable diagnostic drift without converting it to a pass", () => {
    const value = fixture();
    const changedShadow = shadow(value.producerBundles, {
      "spine-promotion": { diagnostics: ["DIAGNOSTIC_DRIFT"] },
    });

    const report = evaluateLocalEquivalence({ ...value, splitValidationShadow: changedShadow });

    expect(report.status).toBe("failed");
    expect(report.mismatches).toContainEqual({
      code: "CHECK_DIAGNOSTICS_MISMATCH",
      key: "spine-promotion.diagnostics",
      monolithic: [],
      split: ["DIAGNOSTIC_DRIFT"],
    });
  });

  it("reports exact security outcome drift locally", () => {
    const value = fixture();
    const changedSecurity = value.monolithicSecurity.map((result) =>
      result.id === "blocking-secret-scan"
        ? { ...result, outcome: "failed" as const, diagnostics: ["SECRET_SCAN_FAILED"] }
        : result,
    );

    const report = evaluateLocalEquivalence({ ...value, monolithicSecurity: changedSecurity });

    expect(report.status).toBe("failed");
    expect(report.mismatches.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "BLOCKING_OUTCOME_MISMATCH",
        "SECURITY_OUTCOME_MISMATCH",
        "SECURITY_DIAGNOSTICS_MISMATCH",
      ]),
    );
    expect(report.monolithicBlockingOutcome).toBe("failed");
  });

  it("accepts an equivalent blocking security failure on both architectures", () => {
    const value = fixture();
    const failedSecurity = value.monolithicSecurity.map((result) =>
      result.id === "blocking-secret-scan"
        ? { ...result, outcome: "failed" as const, diagnostics: ["SECRET_SCAN_FAILED"] }
        : result,
    );
    const failedShadow = shadow(
      value.producerBundles,
      {},
      {
        "blocking-secret-scan": {
          outcome: "failed",
          diagnostics: ["SECRET_SCAN_FAILED"],
        },
      },
    );

    const report = evaluateLocalEquivalence({
      ...value,
      monolithicSecurity: failedSecurity,
      splitValidationShadow: failedShadow,
    });

    expect(report.status).toBe("passed");
    expect(report.monolithicBlockingOutcome).toBe("failed");
    expect(report.splitBlockingOutcome).toBe("failed");
  });

  it("leaves hosted security artifact transport outside local equivalence", () => {
    const value = fixture();
    const changedSecurity = value.monolithicSecurity.map((result) =>
      result.id === "security-upload"
        ? { ...result, outcome: "failed" as const, diagnostics: ["UPLOAD_FAILED"] }
        : result,
    );

    const report = evaluateLocalEquivalence({ ...value, monolithicSecurity: changedSecurity });

    expect(report.status).toBe("passed");
    expect(report.comparedSecurityCount).toBe(4);
    expect(report.hostedOnlyMetrics.artifactService).toBe("not-measured");
  });

  it("returns a nonzero CLI status and persists the deterministic failed report", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-local-equivalence-"));
    const value = fixture();
    const changedShadow = shadow(value.producerBundles, {
      "spine-promotion": { diagnostics: ["DIAGNOSTIC_DRIFT"] },
    });
    const paths = {
      identity: join(directory, "identity.json"),
      monolithic: join(directory, "monolithic.json"),
      monolithicSecurity: join(directory, "monolithic-security.json"),
      shadow: join(directory, "shadow.json"),
      output: join(directory, "report.json"),
    };
    const producerPaths = value.producerBundles.map((_, index) =>
      join(directory, `producer-${index}.json`),
    );
    writeFileSync(paths.identity, JSON.stringify(value.identity));
    writeFileSync(paths.monolithic, JSON.stringify(value.monolithic));
    writeFileSync(paths.monolithicSecurity, JSON.stringify(value.monolithicSecurity));
    writeFileSync(paths.shadow, JSON.stringify(changedShadow));
    value.producerBundles.forEach((bundleValue, index) => {
      const path = producerPaths[index];
      if (path) writeFileSync(path, JSON.stringify(bundleValue));
    });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const status = runLocalEquivalenceCli([
        "--identity",
        paths.identity,
        "--monolithic",
        paths.monolithic,
        "--monolithic-security",
        paths.monolithicSecurity,
        ...producerPaths.flatMap((path) => ["--producer", path]),
        "--shadow",
        paths.shadow,
        "--output",
        paths.output,
      ]);

      expect(status).toBe(1);
      expect(JSON.parse(readFileSync(paths.output, "utf8"))).toMatchObject({
        status: "failed",
        hostedOnlyMetrics: {
          queueInclusiveP95: "not-measured",
          runnerScheduling: "not-measured",
          artifactService: "not-measured",
        },
      });
    } finally {
      stdout.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
