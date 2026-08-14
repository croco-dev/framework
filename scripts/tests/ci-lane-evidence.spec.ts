import { describe, expect, it } from "vitest";

import { SECURITY_OWNERSHIP } from "../ci-cacheable-lanes-evaluator.mts";
import { VERIFICATION_LANE_OWNERSHIP } from "../verification-manifest.mts";
import {
  CiLaneEvidenceError,
  createCurrentRunAttestation,
  createProducerBundle,
  createReusableReceipt,
  createSplitValidationShadowEvidence,
  evidenceDigest,
  formatCiLaneEvidenceError,
  parseCurrentRunAttestation,
  parseExperimentIdentity,
  parseProducerBundle,
  parseReusableReceipt,
  parseSplitValidationShadowEvidence,
  PRODUCER_LANES,
  SPLIT_VALIDATION_SHADOW_REPORT_PATH,
  splitValidationShadowArtifactName,
  splitValidationShadowReportPath,
  validateProducerFanIn,
} from "../ci-lane-evidence.mts";
import type {
  CacheOrigin,
  CurrentRunAttestation,
  EvidenceIdentity,
  ProducerBundle,
  ProducerCheckResult,
  ProducerLane,
  ReusableReceipt,
  SplitValidationShadowEvidence,
  SynthesisCheckResult,
  SynthesisSecurityResult,
} from "../ci-lane-evidence.mts";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const SHA = "c".repeat(40);
const STARTED_AT = "2026-08-14T01:00:00.000Z";
const ISSUED_AT = "2026-08-14T01:05:00.000Z";
const COMPLETED_AT = "2026-08-14T01:10:00.000Z";

const baseIdentity = {
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

function checkIdsOwnedBy(lane: ProducerLane | "split-validation-shadow"): readonly string[] {
  return Object.entries(VERIFICATION_LANE_OWNERSHIP)
    .filter(([, owner]) => owner === lane)
    .map(([checkId]) => checkId);
}

const allSelectedCheckIds = PRODUCER_LANES.flatMap((lane) => [...checkIdsOwnedBy(lane)]);
const fanInExpectation = { ...baseIdentity, selectedCheckIds: allSelectedCheckIds } as const;
const allSynthesizedCheckIds = Object.keys(VERIFICATION_LANE_OWNERSHIP);
const synthesisExpectation = {
  ...baseIdentity,
  selectedCheckIds: allSynthesizedCheckIds,
  producerBundleDigests: PRODUCER_LANES.map((lane) => ({
    lane,
    bundleDigest: bundle(lane).bundleDigest,
  })),
} as const;

describe("experiment identity", () => {
  it("accepts the exact shared monolith and split identity envelope", () => {
    expect(parseExperimentIdentity(baseIdentity)).toEqual(baseIdentity);
  });

  it("rejects unknown fields and stale run identity", () => {
    expect(() => parseExperimentIdentity({ ...baseIdentity, lane: "core-verification" })).toThrow(
      CiLaneEvidenceError,
    );
    expect(() => parseExperimentIdentity({ ...baseIdentity, runAttempt: 0 })).toThrow(
      CiLaneEvidenceError,
    );
  });
});

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
  cache: {
    origin: CacheOrigin;
    revalidated: boolean;
    policyDigest: string | null;
  } = { origin: "executed", revalidated: true, policyDigest: null },
): ReusableReceipt {
  return createReusableReceipt({
    lane,
    checkId,
    profile: baseIdentity.profile,
    manifestDigest: baseIdentity.manifestDigest,
    inventoryDigest: baseIdentity.inventoryDigest,
    toolchainDigest: baseIdentity.toolchainDigest,
    inputDigest: baseIdentity.inputDigest,
    contentHash: DIGEST_A,
    taskHash: DIGEST_A,
    commandDigest: DIGEST_A,
    cache,
    outputs: [output(lane, checkId)],
  });
}

function attestation(options: {
  lane: ProducerLane;
  checkId: string;
  decision: "passed" | "failed" | "not-applicable";
  receiptDigest: string | null;
  outputDigest?: string | null;
  diagnostics?: readonly string[];
  identity?: Partial<EvidenceIdentity>;
  issuedAt?: string;
}): CurrentRunAttestation {
  return createCurrentRunAttestation({
    commitSha: options.identity?.commitSha ?? baseIdentity.commitSha,
    runId: options.identity?.runId ?? baseIdentity.runId,
    runAttempt: options.identity?.runAttempt ?? baseIdentity.runAttempt,
    profile: options.identity?.profile ?? baseIdentity.profile,
    lane: options.lane,
    checkId: options.checkId,
    manifestDigest: options.identity?.manifestDigest ?? baseIdentity.manifestDigest,
    inventoryDigest: options.identity?.inventoryDigest ?? baseIdentity.inventoryDigest,
    toolchainDigest: options.identity?.toolchainDigest ?? baseIdentity.toolchainDigest,
    inputDigest: options.identity?.inputDigest ?? baseIdentity.inputDigest,
    receiptDigest: options.receiptDigest,
    outputDigest:
      options.outputDigest ??
      (options.receiptDigest === null
        ? null
        : evidenceDigest([output(options.lane, options.checkId)])),
    decision: options.decision,
    diagnostics: options.diagnostics ?? [],
    issuedAt: options.issuedAt ?? ISSUED_AT,
  });
}

function bundle(
  lane: ProducerLane,
  options: {
    notApplicable?: ReadonlySet<string>;
    failed?: string;
    identity?: Partial<EvidenceIdentity>;
    receiptFor?: (lane: ProducerLane, checkId: string) => ReusableReceipt;
  } = {},
): ProducerBundle {
  const identity = { ...baseIdentity, ...options.identity, lane } as const;
  const receipts: ReusableReceipt[] = [];
  const attestations: CurrentRunAttestation[] = [];
  const checks: ProducerCheckResult[] = [];
  for (const checkId of checkIdsOwnedBy(lane)) {
    const isNotApplicable = options.notApplicable?.has(checkId) ?? false;
    const isFailed = options.failed === checkId;
    const checkReceipt =
      isNotApplicable || isFailed ? null : (options.receiptFor ?? receipt)(lane, checkId);
    if (checkReceipt) receipts.push(checkReceipt);
    const decision = isNotApplicable ? "not-applicable" : isFailed ? "failed" : "passed";
    const diagnostics = isFailed ? ["INJECTED_FAILURE"] : [];
    const checkAttestation = attestation({
      lane,
      checkId,
      decision,
      receiptDigest: checkReceipt?.receiptDigest ?? null,
      outputDigest: checkReceipt ? evidenceDigest(checkReceipt.outputs) : null,
      diagnostics,
      identity,
    });
    attestations.push(checkAttestation);
    checks.push({
      id: checkId,
      selection: isNotApplicable ? "not-applicable" : "selected",
      semantics: checkId === "core-coverage-warning" ? "advisory" : "blocking",
      outcome: decision,
      receiptDigest: checkReceipt?.receiptDigest ?? null,
      attestationDigest: checkAttestation.attestationDigest,
      diagnostics,
    });
  }
  return createProducerBundle({
    ...identity,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    status: options.failed ? "failure" : "success",
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

function shadowEvidence(
  options: {
    failedCheck?: string;
    failedSecurity?: string;
    operationalFailure?: string | null;
    conclusion?: "success" | "failure" | "cancelled" | "skipped";
  } = {},
): SplitValidationShadowEvidence {
  const checks: SynthesisCheckResult[] = allSynthesizedCheckIds.map((id) => {
    const failed = options.failedCheck === id;
    return {
      id,
      selection: "selected",
      semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
      outcome: failed ? "failed" : "passed",
      diagnostics: failed ? ["INJECTED_CHECK_FAILURE"] : [],
    };
  });
  const security: SynthesisSecurityResult[] = SECURITY_OWNERSHIP.map((entry) => {
    const failed = options.failedSecurity === entry.id;
    return {
      ...entry,
      outcome: failed ? "failed" : "passed",
      diagnostics: failed ? ["INJECTED_SECURITY_FAILURE"] : [],
    };
  });
  const operationalFailure = options.operationalFailure ?? null;
  const hasBlockingFailure =
    options.failedCheck !== undefined && options.failedCheck !== "core-coverage-warning";
  return createSplitValidationShadowEvidence({
    ...baseIdentity,
    producerBundles: PRODUCER_LANES.map((lane) => ({
      lane,
      bundleDigest: bundle(lane).bundleDigest,
    })),
    checks,
    security,
    conclusion:
      options.conclusion ??
      (hasBlockingFailure || options.failedSecurity === "blocking-secret-scan" || operationalFailure
        ? "failure"
        : "success"),
    operationalFailure,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    issuedAt: ISSUED_AT,
  });
}

function mutateReceipt(
  source: ReusableReceipt,
  mutate: (value: Record<string, unknown>) => void,
): Record<string, unknown> {
  const value = structuredClone(source) as unknown as Record<string, unknown>;
  mutate(value);
  return value;
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CiLaneEvidenceError);
    expect((error as CiLaneEvidenceError).code).toBe(code);
  }
}

describe("reusable computation receipts", () => {
  it("binds lane, task, normalized inputs, command, toolchain, and exact outputs", () => {
    const value = receipt("generated-apps", "generated-app-smoke");
    expect(parseReusableReceipt(value)).toEqual(value);

    for (const field of [
      "taskHash",
      "contentHash",
      "commandDigest",
      "inputDigest",
      "toolchainDigest",
      "manifestDigest",
      "inventoryDigest",
    ]) {
      expectCode(
        () =>
          parseReusableReceipt(mutateReceipt(value, (candidate) => (candidate[field] = DIGEST_B))),
        "RECEIPT_DIGEST_MISMATCH",
      );
    }
    expectCode(
      () =>
        parseReusableReceipt(
          mutateReceipt(value, (candidate) => {
            const outputs = candidate.outputs as Record<string, unknown>[];
            const first = outputs[0];
            if (first) first.digest = DIGEST_A;
          }),
        ),
      "RECEIPT_DIGEST_MISMATCH",
    );
  });

  it("rejects altered paths and legacy workspace state before digest acceptance", () => {
    const value = receipt("generated-apps", "generated-app-smoke");
    for (const path of [
      ".turbo/runs/summary.json",
      "packages/create-croco-app/dist/index.js",
      "ci-reports/release/checkpoint.json",
      "../foreign/report.json",
    ]) {
      expectCode(
        () =>
          parseReusableReceipt(
            mutateReceipt(value, (candidate) => {
              const outputs = candidate.outputs as Record<string, unknown>[];
              const first = outputs[0];
              if (first) first.path = path;
            }),
          ),
        path.startsWith("..") ? "UNSAFE_EVIDENCE_PATH" : "LEGACY_WORKSPACE_PATH",
      );
    }
  });

  it("rejects restore-prefix and fork candidates and requires exact/OIDC revalidation", () => {
    expectCode(
      () =>
        receipt("generated-apps", "generated-app-smoke", {
          origin: "github-restore-prefix",
          revalidated: true,
          policyDigest: null,
        }),
      "UNTRUSTED_RESTORE_PREFIX",
    );
    expectCode(
      () =>
        receipt("generated-apps", "generated-app-smoke", {
          origin: "fork",
          revalidated: true,
          policyDigest: null,
        }),
      "UNTRUSTED_FORK_CACHE",
    );
    expectCode(
      () =>
        receipt("generated-apps", "generated-app-smoke", {
          origin: "github-exact-key",
          revalidated: false,
          policyDigest: null,
        }),
      "CACHE_CANDIDATE_NOT_REVALIDATED",
    );
    expectCode(
      () =>
        receipt("generated-apps", "generated-app-smoke", {
          origin: "oidc-signed",
          revalidated: true,
          policyDigest: null,
        }),
      "OIDC_POLICY_NOT_VERIFIED",
    );
    expect(
      receipt("generated-apps", "generated-app-smoke", {
        origin: "github-exact-key",
        revalidated: true,
        policyDigest: null,
      }).cache.origin,
    ).toBe("github-exact-key");
    expect(
      receipt("generated-apps", "generated-app-smoke", {
        origin: "oidc-signed",
        revalidated: true,
        policyDigest: DIGEST_B,
      }).cache.origin,
    ).toBe("oidc-signed");
    const signed = receipt("generated-apps", "generated-app-smoke", {
      origin: "oidc-signed",
      revalidated: true,
      policyDigest: DIGEST_B,
    });
    expectCode(() => parseReusableReceipt({ ...signed, outputs: [] }), "MISSING_EVIDENCE_OUTPUT");
  });
});

describe("fresh current-run attestations", () => {
  it("requires a digest-bound receipt for pass and no receipt for N/A", () => {
    const checkReceipt = receipt("generated-apps", "generated-app-smoke");
    expect(
      attestation({
        lane: "generated-apps",
        checkId: "generated-app-smoke",
        decision: "passed",
        receiptDigest: checkReceipt.receiptDigest,
      }).fresh,
    ).toBe(true);
    expectCode(
      () =>
        attestation({
          lane: "generated-apps",
          checkId: "generated-app-smoke",
          decision: "passed",
          receiptDigest: null,
        }),
      "PASSED_WITHOUT_RECEIPT",
    );
    expectCode(
      () =>
        attestation({
          lane: "generated-apps",
          checkId: "generated-app-smoke",
          decision: "not-applicable",
          receiptDigest: checkReceipt.receiptDigest,
        }),
      "NA_WITH_RECEIPT",
    );
  });

  it("rejects an old or explicitly stale attestation", () => {
    const value = attestation({
      lane: "generated-apps",
      checkId: "generated-app-smoke",
      decision: "passed",
      receiptDigest: receipt("generated-apps", "generated-app-smoke").receiptDigest,
    });
    expectCode(() => parseCurrentRunAttestation({ ...value, fresh: false }), "STALE_ATTESTATION");
    expectCode(
      () => parseCurrentRunAttestation({ ...value, receiptDigest: DIGEST_B }),
      "ATTESTATION_DIGEST_MISMATCH",
    );
    expectCode(
      () => parseCurrentRunAttestation({ ...value, outputDigest: DIGEST_A }),
      "ATTESTATION_DIGEST_MISMATCH",
    );
  });
});

describe("immutable producer bundles", () => {
  it("accepts exact selected/N-A ownership and fresh attestations", () => {
    const value = bundle("core-verification", {
      notApplicable: new Set(["changeset-required", "verification-contract-tests"]),
    });
    expect(parseProducerBundle(value)).toEqual(value);
    expect(value.checks.filter(({ selection }) => selection === "not-applicable")).toHaveLength(2);
    expect(value.attestations).toHaveLength(checkIdsOwnedBy("core-verification").length);
  });

  it("rejects missing, duplicate, unexpected, and inconsistent check ownership", () => {
    const value = bundle("generated-apps");
    expectCode(() => parseProducerBundle({ ...value, checks: [] }), "OWNERSHIP_SET_MISMATCH");

    const duplicate = { ...value, checks: [...value.checks, ...value.checks.slice(0, 1)] };
    expectCode(() => parseProducerBundle(duplicate), "DUPLICATE_EVIDENCE");

    const unexpected = {
      ...value,
      checks: value.checks.map((check, index) => (index === 0 ? { ...check, id: "build" } : check)),
    };
    expectCode(() => parseProducerBundle(unexpected), "OWNERSHIP_SET_MISMATCH");

    const inconsistent = {
      ...value,
      checks: value.checks.map((check, index) =>
        index === 0 ? { ...check, selection: "not-applicable" as const } : check,
      ),
    };
    expectCode(() => parseProducerBundle(inconsistent), "INVALID_NA_RESULT");
  });

  it("binds artifact identity, files, aggregate outputs, and the complete bundle", () => {
    const value = bundle("package-artifacts");
    expectCode(
      () => parseProducerBundle({ ...value, artifact: { ...value.artifact, name: "foreign" } }),
      "ARTIFACT_IDENTITY_MISMATCH",
    );
    expectCode(
      () => parseProducerBundle({ ...value, artifact: { ...value.artifact, digest: DIGEST_A } }),
      "ARTIFACT_DIGEST_MISMATCH",
    );
    expectCode(
      () => parseProducerBundle({ ...value, outputDigest: DIGEST_B }),
      "OUTPUT_DIGEST_MISMATCH",
    );
    expectCode(
      () => parseProducerBundle({ ...value, verificationExperimentId: "altered" }),
      "BUNDLE_DIGEST_MISMATCH",
    );
  });

  it("rejects receipt identity that differs from its producer bundle", () => {
    const identityMutations: Partial<EvidenceIdentity>[] = [
      { profile: "spine" },
      { manifestDigest: DIGEST_B },
      { inventoryDigest: DIGEST_B },
      { toolchainDigest: DIGEST_B },
      { inputDigest: DIGEST_B },
    ];
    for (const identity of identityMutations) {
      expectCode(() => bundle("generated-apps", { identity }), "RECEIPT_IDENTITY_MISMATCH");
    }
  });

  it("rejects attestations issued outside the bundle execution window", () => {
    const value = bundle("generated-apps");
    const old = attestation({
      lane: "generated-apps",
      checkId: "generated-app-smoke",
      decision: "passed",
      receiptDigest: value.receipts[0]?.receiptDigest ?? null,
      issuedAt: "2026-08-13T01:05:00.000Z",
    });
    const stale = {
      ...value,
      attestations: value.attestations.map((entry, index) => (index === 0 ? old : entry)),
      checks: value.checks.map((check, index) =>
        index === 0 ? { ...check, attestationDigest: old.attestationDigest } : check,
      ),
    };
    expectCode(() => parseProducerBundle(stale), "STALE_ATTESTATION");
  });

  it("rejects a fresh attestation that does not bind the receipt's exact outputs", () => {
    const value = bundle("generated-apps");
    const check = value.checks[0];
    const receiptValue = value.receipts[0];
    if (!check || !receiptValue) throw new Error("fixture must contain one generated-app check");
    const altered = attestation({
      lane: "generated-apps",
      checkId: check.id,
      decision: "passed",
      receiptDigest: receiptValue.receiptDigest,
      outputDigest: DIGEST_A,
    });
    expectCode(
      () =>
        parseProducerBundle({
          ...value,
          checks: [{ ...check, attestationDigest: altered.attestationDigest }],
          attestations: [altered],
        }),
      "ATTESTATION_OUTPUT_MISMATCH",
    );
  });
});

describe("four-producer fan-in", () => {
  function allBundles(): ProducerBundle[] {
    return PRODUCER_LANES.map((lane) => bundle(lane));
  }

  it("accepts exactly four successful current-run producer bundles", () => {
    const result = validateProducerFanIn(allBundles(), fanInExpectation);
    expect(Object.keys(result).sort()).toEqual([...PRODUCER_LANES].sort());
  });

  it("requires selected and N/A results to match the trusted manifest selection", () => {
    const generatedNotApplicable = bundle("generated-apps", {
      notApplicable: new Set(["generated-app-smoke"]),
    });
    expectCode(
      () =>
        validateProducerFanIn(
          [bundle("core-verification"), generatedNotApplicable, ...allBundles().slice(2)],
          fanInExpectation,
        ),
      "SELECTION_MISMATCH",
    );
    expectCode(
      () =>
        validateProducerFanIn(allBundles(), {
          ...fanInExpectation,
          selectedCheckIds: [...allSelectedCheckIds, "foreign-check"],
        }),
      "UNEXPECTED_SELECTED_CHECK",
    );
  });

  it("rejects missing, duplicate, unexpected, and stale producers while preserving valid failures", () => {
    expectCode(
      () => validateProducerFanIn(allBundles().slice(1), fanInExpectation),
      "MISSING_PRODUCER_LANE",
    );
    expectCode(
      () => validateProducerFanIn([...allBundles(), bundle("core-verification")], fanInExpectation),
      "DUPLICATE_EVIDENCE",
    );
    expectCode(
      () =>
        validateProducerFanIn(
          [
            ...allBundles().slice(1),
            { ...bundle("core-verification"), lane: "validate-synthesis" },
          ],
          fanInExpectation,
        ),
      "INVALID_SCHEMA",
    );
    for (const staleIdentity of [
      { commitSha: "d".repeat(40) },
      { runId: "old-run" },
      { runAttempt: 2 },
      { profile: "spine" as const },
    ]) {
      expectCode(
        () =>
          validateProducerFanIn(allBundles(), {
            ...fanInExpectation,
            ...staleIdentity,
          }),
        "IDENTITY_MISMATCH",
      );
    }
    expect(
      validateProducerFanIn(
        [
          bundle("core-verification", { failed: "verification-policy" }),
          ...PRODUCER_LANES.slice(1).map((lane) => bundle(lane)),
        ],
        fanInExpectation,
      )["core-verification"].status,
    ).toBe("failure");
  });

  it("formats stable diagnostics without losing the machine code", () => {
    try {
      validateProducerFanIn(allBundles().slice(1), fanInExpectation);
      throw new Error("expected failure");
    } catch (error) {
      expect(formatCiLaneEvidenceError(error)).toBe(
        "MISSING_PRODUCER_LANE: fan-in is missing producer lane(s): core-verification",
      );
    }
  });
});

describe("split-validation-shadow evidence", () => {
  it("binds canonical transport identity and exact 53 checks plus five security records", () => {
    const value = shadowEvidence();
    expect(parseSplitValidationShadowEvidence(value, synthesisExpectation)).toEqual(value);
    expect(value.checks).toHaveLength(53);
    expect(value.security).toHaveLength(5);
    expect(value.producerBundles).toHaveLength(4);
    expect(value.blockingOutcome).toBe("passed");
    expect(value.conclusion).toBe("success");
    expect(splitValidationShadowReportPath()).toBe(SPLIT_VALIDATION_SHADOW_REPORT_PATH);
    expect(splitValidationShadowArtifactName(baseIdentity.runId, baseIdentity.runAttempt)).toBe(
      "ci-lane-split-validation-shadow-123456-1",
    );
  });

  it("rejects missing, duplicate, and unexpected producer bundle digests", () => {
    const value = shadowEvidence();
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, producerBundles: value.producerBundles.slice(1) },
          synthesisExpectation,
        ),
      "MISSING_PRODUCER_DIGEST",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            producerBundles: [...value.producerBundles.slice(0, 3), value.producerBundles[0]],
          },
          synthesisExpectation,
        ),
      "DUPLICATE_EVIDENCE",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            producerBundles: [
              ...value.producerBundles,
              { lane: "validate-synthesis", bundleDigest: DIGEST_A },
            ],
          },
          synthesisExpectation,
        ),
      "UNEXPECTED_PRODUCER_DIGEST",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            producerBundles: value.producerBundles.map((reference, index) =>
              index === 0 ? { ...reference, bundleDigest: DIGEST_A } : reference,
            ),
          },
          synthesisExpectation,
        ),
      "PRODUCER_DIGEST_MISMATCH",
    );
  });

  it("rejects missing, duplicate, unexpected, or semantically altered synthesized results", () => {
    const value = shadowEvidence();
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, checks: value.checks.slice(1) },
          synthesisExpectation,
        ),
      "SYNTHESIZED_CHECK_SET_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, checks: [...value.checks, ...value.checks.slice(0, 1)] },
          synthesisExpectation,
        ),
      "DUPLICATE_EVIDENCE",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            checks: value.checks.map((check, index) =>
              index === 0 ? { ...check, id: "foreign-check" } : check,
            ),
          },
          synthesisExpectation,
        ),
      "SYNTHESIZED_CHECK_SET_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            checks: value.checks.map((check) =>
              check.id === "build" ? { ...check, semantics: "advisory" as const } : check,
            ),
          },
          synthesisExpectation,
        ),
      "CHECK_SEMANTICS_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, security: value.security.slice(1) },
          synthesisExpectation,
        ),
      "SECURITY_RESULT_SET_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          {
            ...value,
            security: value.security.map((result) =>
              result.id === "blocking-secret-scan"
                ? { ...result, owner: "validate-synthesis" }
                : result,
            ),
          },
          synthesisExpectation,
        ),
      "SECURITY_SEMANTICS_MISMATCH",
    );
  });

  it("rejects selection drift, stale current-run identity, and old evidence", () => {
    const value = shadowEvidence();
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(value, {
          ...synthesisExpectation,
          selectedCheckIds: synthesisExpectation.selectedCheckIds.slice(1),
        }),
      "SELECTION_MISMATCH",
    );
    for (const staleIdentity of [
      { commitSha: "d".repeat(40) },
      { runId: "old-run" },
      { runAttempt: 2 },
      { profile: "spine" as const },
      { manifestDigest: DIGEST_B },
      { inventoryDigest: DIGEST_B },
      { toolchainDigest: DIGEST_B },
      { inputDigest: DIGEST_B },
    ]) {
      expectCode(
        () =>
          parseSplitValidationShadowEvidence(value, {
            ...synthesisExpectation,
            ...staleIdentity,
          }),
        "SYNTHESIS_IDENTITY_MISMATCH",
      );
    }
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, issuedAt: "2026-08-13T01:05:00.000Z" },
          synthesisExpectation,
        ),
      "STALE_SYNTHESIS_EVIDENCE",
    );
    expectCode(
      () => parseSplitValidationShadowEvidence({ ...value, fresh: false }, synthesisExpectation),
      "STALE_SYNTHESIS_EVIDENCE",
    );
  });

  it("rejects noncanonical and legacy transport paths", () => {
    const value = shadowEvidence();
    for (const reportPath of [
      ".turbo/split-validation-shadow.json",
      "dist/split-validation-shadow.json",
      "ci-reports/checkpoint/split-validation-shadow.json",
    ]) {
      expectCode(
        () => parseSplitValidationShadowEvidence({ ...value, reportPath }, synthesisExpectation),
        "LEGACY_WORKSPACE_PATH",
      );
    }
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, reportPath: "ci-reports/cacheable-ci/other.json" },
          synthesisExpectation,
        ),
      "REPORT_PATH_MISMATCH",
    );
  });

  it("fails closed on blocking, operational, diagnostic, artifact, and digest drift", () => {
    expect(shadowEvidence({ failedCheck: "core-coverage-warning" }).conclusion).toBe("success");
    expect(shadowEvidence({ failedCheck: "build" }).blockingOutcome).toBe("failed");
    expect(shadowEvidence({ failedSecurity: "blocking-secret-scan" }).conclusion).toBe("failure");
    expectCode(
      () => shadowEvidence({ operationalFailure: "RUNNER_LOST", conclusion: "success" }),
      "OPERATIONAL_FAILURE_MASKED",
    );

    const value = shadowEvidence();
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, blockingOutcome: "failed" },
          synthesisExpectation,
        ),
      "BLOCKING_OUTCOME_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, stableDiagnostics: ["UNBOUND_DIAGNOSTIC"] },
          synthesisExpectation,
        ),
      "STABLE_DIAGNOSTICS_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, artifactName: "ci-lane-split-validation-shadow-old-1" },
          synthesisExpectation,
        ),
      "ARTIFACT_IDENTITY_MISMATCH",
    );
    expectCode(
      () =>
        parseSplitValidationShadowEvidence(
          { ...value, evidenceDigest: DIGEST_A },
          synthesisExpectation,
        ),
      "SYNTHESIS_EVIDENCE_DIGEST_MISMATCH",
    );
  });
});
