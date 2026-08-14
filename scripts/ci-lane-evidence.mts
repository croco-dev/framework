import { createHash } from "node:crypto";

import { ADVISORY_CHECK_IDS, SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { VerificationProblem } from "./verification-problem.mts";
import type {
  SecurityResultId,
  SecurityResultOwner,
  SecurityResultSemantics,
} from "./ci-verification-contract.mts";
import { VERIFICATION_LANE_OWNERSHIP } from "./verification-manifest.mts";

export const LANE_RECEIPT_SCHEMA = "croco.ci-lane-receipt/v1" as const;
export const LANE_ATTESTATION_SCHEMA = "croco.ci-lane-attestation/v1" as const;
export const PRODUCER_BUNDLE_SCHEMA = "croco.ci-producer-bundle/v1" as const;
export const SPLIT_VALIDATION_SHADOW_SCHEMA =
  "croco.ci-split-validation-shadow-evidence/v1" as const;
export const SPLIT_VALIDATION_SHADOW_REPORT_PATH =
  "ci-reports/cacheable-ci/split-validation-shadow.json" as const;

export const PRODUCER_LANES = [
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
] as const;

const SYNTHESIZED_CHECK_IDS = Object.keys(VERIFICATION_LANE_OWNERSHIP);

function checkIdsOwnedBy(lane: ProducerLane | "split-validation-shadow"): readonly string[] {
  return Object.entries(VERIFICATION_LANE_OWNERSHIP)
    .filter(([, owner]) => owner === lane)
    .map(([checkId]) => checkId);
}

export type ProducerLane = (typeof PRODUCER_LANES)[number];
export type VerificationProfile = "repo" | "spine" | "publish";
export type ArchitectureVersion = "shadow-split" | "cutover-split";
export type CheckSelection = "selected" | "not-applicable";
export type CheckOutcome = "passed" | "failed" | "not-applicable";
export type CacheOrigin =
  | "executed"
  | "github-exact-key"
  | "github-restore-prefix"
  | "fork"
  | "oidc-signed";

export type EvidenceIdentity = {
  readonly architectureVersion: ArchitectureVersion;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly profile: VerificationProfile;
  readonly lane: ProducerLane;
  readonly manifestDigest: string;
  readonly inventoryDigest: string;
  readonly toolchainDigest: string;
  readonly inputDigest: string;
  readonly verificationExperimentId: string;
};

export type ExperimentIdentity = Omit<EvidenceIdentity, "lane">;

export type EvidenceOutput = {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
};

export type ReusableReceipt = {
  readonly schemaVersion: typeof LANE_RECEIPT_SCHEMA;
  readonly lane: ProducerLane;
  readonly checkId: string;
  readonly profile: VerificationProfile;
  readonly manifestDigest: string;
  readonly inventoryDigest: string;
  readonly toolchainDigest: string;
  readonly inputDigest: string;
  readonly contentHash: string;
  readonly taskHash: string;
  readonly commandDigest: string;
  readonly cache: {
    readonly origin: CacheOrigin;
    readonly revalidated: boolean;
    readonly policyDigest: string | null;
  };
  readonly outputs: readonly EvidenceOutput[];
  readonly receiptDigest: string;
};

export type CurrentRunAttestation = {
  readonly schemaVersion: typeof LANE_ATTESTATION_SCHEMA;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly profile: VerificationProfile;
  readonly lane: ProducerLane;
  readonly checkId: string;
  readonly manifestDigest: string;
  readonly inventoryDigest: string;
  readonly toolchainDigest: string;
  readonly inputDigest: string;
  readonly receiptDigest: string | null;
  readonly outputDigest: string | null;
  readonly decision: CheckOutcome;
  readonly diagnostics: readonly string[];
  readonly issuedAt: string;
  readonly fresh: true;
  readonly attestationDigest: string;
};

export type ProducerCheckResult = {
  readonly id: string;
  readonly selection: CheckSelection;
  readonly semantics: "blocking" | "advisory";
  readonly outcome: CheckOutcome;
  readonly receiptDigest: string | null;
  readonly attestationDigest: string;
  readonly diagnostics: readonly string[];
};

export type ProducerBundle = EvidenceIdentity & {
  readonly schemaVersion: typeof PRODUCER_BUNDLE_SCHEMA;
  readonly artifact: {
    readonly name: string;
    readonly files: readonly EvidenceOutput[];
    readonly digest: string;
  };
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: "success" | "failure";
  readonly checks: readonly ProducerCheckResult[];
  readonly receipts: readonly ReusableReceipt[];
  readonly attestations: readonly CurrentRunAttestation[];
  readonly outputDigest: string;
  readonly bundleDigest: string;
};

export type FanInExpectation = Omit<EvidenceIdentity, "lane"> & {
  readonly selectedCheckIds: readonly string[];
};

export type SynthesisCheckResult = {
  readonly id: string;
  readonly selection: CheckSelection;
  readonly semantics: "blocking" | "advisory";
  readonly outcome: CheckOutcome;
  readonly diagnostics: readonly string[];
};

export type SynthesisSecurityResult = {
  readonly id: SecurityResultId;
  readonly owner: SecurityResultOwner;
  readonly semantics: SecurityResultSemantics;
  readonly outcome: CheckOutcome;
  readonly diagnostics: readonly string[];
};

export type ProducerBundleDigest = {
  readonly lane: ProducerLane;
  readonly bundleDigest: string;
};

export type SplitValidationShadowExpectation = Omit<EvidenceIdentity, "lane"> & {
  readonly selectedCheckIds: readonly string[];
  readonly producerBundleDigests: readonly ProducerBundleDigest[];
};

export type SplitValidationShadowEvidence = Omit<EvidenceIdentity, "lane"> & {
  readonly schemaVersion: typeof SPLIT_VALIDATION_SHADOW_SCHEMA;
  readonly lane: "split-validation-shadow";
  readonly reportPath: typeof SPLIT_VALIDATION_SHADOW_REPORT_PATH;
  readonly artifactName: string;
  readonly producerBundles: readonly ProducerBundleDigest[];
  readonly checks: readonly SynthesisCheckResult[];
  readonly security: readonly SynthesisSecurityResult[];
  readonly blockingOutcome: "passed" | "failed";
  readonly conclusion: "success" | "failure" | "cancelled" | "skipped";
  readonly operationalFailure: string | null;
  readonly stableDiagnostics: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly issuedAt: string;
  readonly fresh: true;
  readonly evidenceDigest: string;
};

export class CiLaneEvidenceError extends VerificationProblem {
  readonly key?: string;

  constructor(code: string, message: string, key?: string) {
    super(code, "contract", message);
    this.name = "CiLaneEvidenceError";
    if (key !== undefined) this.key = key;
  }
}

function reject(code: string, message: string, key?: string): never {
  throw new CiLaneEvidenceError(code, message, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) reject("INVALID_SCHEMA", `${path} must be an object`, path);
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    reject(
      "UNEXPECTED_FIELD",
      `${path} keys must equal ${sortedExpected.join(",")}; received ${actual.join(",")}`,
      path,
    );
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    reject("INVALID_SCHEMA", `${path} must be a non-empty string`, path);
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    reject("INVALID_SCHEMA", `${path} must be a positive integer`, path);
  return value as number;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    reject("INVALID_SCHEMA", `${path} must be a non-negative integer`, path);
  return value as number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") reject("INVALID_SCHEMA", `${path} must be a boolean`, path);
  return value;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    reject("INVALID_SCHEMA", `${path} must be one of ${allowed.join(",")}`, path);
  }
  return value as T;
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) reject("INVALID_SCHEMA", `${path} must be an array`, path);
  return value;
}

function stringArray(value: unknown, path: string): readonly string[] {
  const result = array(value, path).map((entry, index) =>
    nonEmptyString(entry, `${path}[${index}]`),
  );
  assertUnique(result, path);
  return result;
}

function digest(value: unknown, path: string): string {
  const result = nonEmptyString(value, path);
  if (!/^[a-f0-9]{64}$/.test(result)) {
    reject("INVALID_DIGEST", `${path} must be a lowercase SHA-256 digest`, path);
  }
  return result;
}

function commitSha(value: unknown, path: string): string {
  const result = nonEmptyString(value, path);
  if (!/^[a-f0-9]{40}$/.test(result)) {
    reject("INVALID_COMMIT_SHA", `${path} must be a lowercase 40-character git SHA`, path);
  }
  return result;
}

function timestamp(value: unknown, path: string): string {
  const result = nonEmptyString(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result) ||
    !Number.isFinite(Date.parse(result))
  ) {
    reject("INVALID_TIMESTAMP", `${path} must be an ISO-8601 UTC timestamp`, path);
  }
  return result;
}

function assertUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) {
    reject("DUPLICATE_EVIDENCE", `${path} must not contain duplicates`, path);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function evidenceDigest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function withoutField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));
}

function expectedArtifactName(
  identity: Pick<EvidenceIdentity, "lane" | "runId" | "runAttempt">,
): string {
  return `ci-lane-${identity.lane}-${identity.runId}-${identity.runAttempt}`;
}

export function splitValidationShadowReportPath(): typeof SPLIT_VALIDATION_SHADOW_REPORT_PATH {
  return SPLIT_VALIDATION_SHADOW_REPORT_PATH;
}

export function splitValidationShadowArtifactName(runId: string, runAttempt: number): string {
  const parsedRunId = nonEmptyString(runId, "runId");
  const parsedRunAttempt = positiveInteger(runAttempt, "runAttempt");
  return `ci-lane-split-validation-shadow-${parsedRunId}-${parsedRunAttempt}`;
}

function normalizePath(value: unknown, path: string): string {
  const result = nonEmptyString(value, path).replaceAll("\\", "/");
  if (
    result.startsWith("/") ||
    /^[A-Za-z]:\//.test(result) ||
    result.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    reject("UNSAFE_EVIDENCE_PATH", `${path} must be a normalized repository-relative path`, path);
  }
  const segments = result.toLowerCase().split("/");
  if (
    segments.includes(".turbo") ||
    segments.includes("dist") ||
    segments.some((segment) => segment.includes("checkpoint"))
  ) {
    reject("LEGACY_WORKSPACE_PATH", `${path} references forbidden mutable workspace state`, path);
  }
  return result;
}

function parseOutput(value: unknown, path: string): EvidenceOutput {
  const output = record(value, path);
  exactKeys(output, ["path", "digest", "bytes"], path);
  return {
    path: normalizePath(output.path, `${path}.path`),
    digest: digest(output.digest, `${path}.digest`),
    bytes: nonNegativeInteger(output.bytes, `${path}.bytes`),
  };
}

function parseOutputs(value: unknown, path: string): readonly EvidenceOutput[] {
  const outputs = array(value, path).map((entry, index) => parseOutput(entry, `${path}[${index}]`));
  if (outputs.length === 0) {
    reject("MISSING_EVIDENCE_OUTPUT", `${path} must contain at least one immutable output`, path);
  }
  assertUnique(
    outputs.map(({ path: outputPath }) => outputPath),
    `${path} paths`,
  );
  return outputs;
}

function parseCache(value: unknown, path: string): ReusableReceipt["cache"] {
  const cache = record(value, path);
  exactKeys(cache, ["origin", "revalidated", "policyDigest"], path);
  const origin = enumeration(
    cache.origin,
    ["executed", "github-exact-key", "github-restore-prefix", "fork", "oidc-signed"],
    `${path}.origin`,
  );
  const revalidated = boolean(cache.revalidated, `${path}.revalidated`);
  const policyDigest =
    cache.policyDigest === null ? null : digest(cache.policyDigest, `${path}.policyDigest`);
  if (origin === "github-restore-prefix") {
    reject(
      "UNTRUSTED_RESTORE_PREFIX",
      `${path}.origin cannot attest a restore-prefix candidate`,
      path,
    );
  }
  if (origin === "fork") {
    reject("UNTRUSTED_FORK_CACHE", `${path}.origin cannot attest a fork cache candidate`, path);
  }
  if (origin === "github-exact-key" && !revalidated) {
    reject(
      "CACHE_CANDIDATE_NOT_REVALIDATED",
      `${path} exact-key candidate requires full revalidation`,
      path,
    );
  }
  if (origin === "oidc-signed" && (!revalidated || policyDigest === null)) {
    reject(
      "OIDC_POLICY_NOT_VERIFIED",
      `${path} signed candidate requires policy and output revalidation`,
      path,
    );
  }
  if (origin === "executed" && (!revalidated || policyDigest !== null)) {
    reject(
      "INVALID_EXECUTED_RECEIPT",
      `${path} executed computation must be revalidated without a policy digest`,
      path,
    );
  }
  return { origin, revalidated, policyDigest };
}

export function parseReusableReceipt(value: unknown, path = "receipt"): ReusableReceipt {
  const receipt = record(value, path);
  exactKeys(
    receipt,
    [
      "schemaVersion",
      "lane",
      "checkId",
      "profile",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
      "contentHash",
      "taskHash",
      "commandDigest",
      "cache",
      "outputs",
      "receiptDigest",
    ],
    path,
  );
  if (receipt.schemaVersion !== LANE_RECEIPT_SCHEMA) {
    reject(
      "INVALID_SCHEMA_VERSION",
      `${path}.schemaVersion must equal ${LANE_RECEIPT_SCHEMA}`,
      path,
    );
  }
  const parsed: ReusableReceipt = {
    schemaVersion: LANE_RECEIPT_SCHEMA,
    lane: enumeration(receipt.lane, PRODUCER_LANES, `${path}.lane`),
    checkId: nonEmptyString(receipt.checkId, `${path}.checkId`),
    profile: enumeration(receipt.profile, ["repo", "spine", "publish"], `${path}.profile`),
    manifestDigest: digest(receipt.manifestDigest, `${path}.manifestDigest`),
    inventoryDigest: digest(receipt.inventoryDigest, `${path}.inventoryDigest`),
    toolchainDigest: digest(receipt.toolchainDigest, `${path}.toolchainDigest`),
    inputDigest: digest(receipt.inputDigest, `${path}.inputDigest`),
    contentHash: digest(receipt.contentHash, `${path}.contentHash`),
    taskHash: digest(receipt.taskHash, `${path}.taskHash`),
    commandDigest: digest(receipt.commandDigest, `${path}.commandDigest`),
    cache: parseCache(receipt.cache, `${path}.cache`),
    outputs: parseOutputs(receipt.outputs, `${path}.outputs`),
    receiptDigest: digest(receipt.receiptDigest, `${path}.receiptDigest`),
  };
  if (!checkIdsOwnedBy(parsed.lane).includes(parsed.checkId)) {
    reject("UNEXPECTED_CHECK_OWNER", `${path}.checkId is not owned by ${parsed.lane}`, path);
  }
  const computed = evidenceDigest(
    withoutField(parsed as unknown as Record<string, unknown>, "receiptDigest"),
  );
  if (computed !== parsed.receiptDigest) {
    reject("RECEIPT_DIGEST_MISMATCH", `${path}.receiptDigest does not bind the receipt`, path);
  }
  return parsed;
}

export function createReusableReceipt(
  value: Omit<ReusableReceipt, "schemaVersion" | "receiptDigest">,
): ReusableReceipt {
  const unsigned = { schemaVersion: LANE_RECEIPT_SCHEMA, ...value };
  return parseReusableReceipt({ ...unsigned, receiptDigest: evidenceDigest(unsigned) });
}

export function parseCurrentRunAttestation(
  value: unknown,
  path = "attestation",
): CurrentRunAttestation {
  const attestation = record(value, path);
  exactKeys(
    attestation,
    [
      "schemaVersion",
      "commitSha",
      "runId",
      "runAttempt",
      "profile",
      "lane",
      "checkId",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
      "receiptDigest",
      "outputDigest",
      "decision",
      "diagnostics",
      "issuedAt",
      "fresh",
      "attestationDigest",
    ],
    path,
  );
  if (attestation.schemaVersion !== LANE_ATTESTATION_SCHEMA) {
    reject(
      "INVALID_SCHEMA_VERSION",
      `${path}.schemaVersion must equal ${LANE_ATTESTATION_SCHEMA}`,
      path,
    );
  }
  const parsed: CurrentRunAttestation = {
    schemaVersion: LANE_ATTESTATION_SCHEMA,
    commitSha: commitSha(attestation.commitSha, `${path}.commitSha`),
    runId: nonEmptyString(attestation.runId, `${path}.runId`),
    runAttempt: positiveInteger(attestation.runAttempt, `${path}.runAttempt`),
    profile: enumeration(attestation.profile, ["repo", "spine", "publish"], `${path}.profile`),
    lane: enumeration(attestation.lane, PRODUCER_LANES, `${path}.lane`),
    checkId: nonEmptyString(attestation.checkId, `${path}.checkId`),
    manifestDigest: digest(attestation.manifestDigest, `${path}.manifestDigest`),
    inventoryDigest: digest(attestation.inventoryDigest, `${path}.inventoryDigest`),
    toolchainDigest: digest(attestation.toolchainDigest, `${path}.toolchainDigest`),
    inputDigest: digest(attestation.inputDigest, `${path}.inputDigest`),
    receiptDigest:
      attestation.receiptDigest === null
        ? null
        : digest(attestation.receiptDigest, `${path}.receiptDigest`),
    outputDigest:
      attestation.outputDigest === null
        ? null
        : digest(attestation.outputDigest, `${path}.outputDigest`),
    decision: enumeration(
      attestation.decision,
      ["passed", "failed", "not-applicable"],
      `${path}.decision`,
    ),
    diagnostics: stringArray(attestation.diagnostics, `${path}.diagnostics`),
    issuedAt: timestamp(attestation.issuedAt, `${path}.issuedAt`),
    fresh:
      attestation.fresh === true
        ? true
        : reject("STALE_ATTESTATION", `${path}.fresh must be true`, path),
    attestationDigest: digest(attestation.attestationDigest, `${path}.attestationDigest`),
  };
  if (!checkIdsOwnedBy(parsed.lane).includes(parsed.checkId)) {
    reject("UNEXPECTED_CHECK_OWNER", `${path}.checkId is not owned by ${parsed.lane}`, path);
  }
  if (parsed.decision === "passed" && parsed.receiptDigest === null) {
    reject("PASSED_WITHOUT_RECEIPT", `${path} passed decision requires a receipt digest`, path);
  }
  if ((parsed.receiptDigest === null) !== (parsed.outputDigest === null)) {
    reject(
      "ATTESTATION_OUTPUT_MISMATCH",
      `${path} receipt and exact output digests must be present together`,
      path,
    );
  }
  if (parsed.decision === "not-applicable" && parsed.receiptDigest !== null) {
    reject("NA_WITH_RECEIPT", `${path} not-applicable decision cannot reference a receipt`, path);
  }
  const computed = evidenceDigest(
    withoutField(parsed as unknown as Record<string, unknown>, "attestationDigest"),
  );
  if (computed !== parsed.attestationDigest) {
    reject(
      "ATTESTATION_DIGEST_MISMATCH",
      `${path}.attestationDigest does not bind the attestation`,
      path,
    );
  }
  return parsed;
}

export function createCurrentRunAttestation(
  value: Omit<CurrentRunAttestation, "schemaVersion" | "fresh" | "attestationDigest">,
): CurrentRunAttestation {
  const unsigned = { schemaVersion: LANE_ATTESTATION_SCHEMA, ...value, fresh: true as const };
  return parseCurrentRunAttestation({ ...unsigned, attestationDigest: evidenceDigest(unsigned) });
}

function parseCheckResult(value: unknown, path: string): ProducerCheckResult {
  const result = record(value, path);
  exactKeys(
    result,
    [
      "id",
      "selection",
      "semantics",
      "outcome",
      "receiptDigest",
      "attestationDigest",
      "diagnostics",
    ],
    path,
  );
  const parsed: ProducerCheckResult = {
    id: nonEmptyString(result.id, `${path}.id`),
    selection: enumeration(result.selection, ["selected", "not-applicable"], `${path}.selection`),
    semantics: enumeration(result.semantics, ["blocking", "advisory"], `${path}.semantics`),
    outcome: enumeration(result.outcome, ["passed", "failed", "not-applicable"], `${path}.outcome`),
    receiptDigest:
      result.receiptDigest === null ? null : digest(result.receiptDigest, `${path}.receiptDigest`),
    attestationDigest: digest(result.attestationDigest, `${path}.attestationDigest`),
    diagnostics: stringArray(result.diagnostics, `${path}.diagnostics`),
  };
  if (
    (parsed.selection === "not-applicable") !== (parsed.outcome === "not-applicable") ||
    (parsed.selection === "not-applicable" && parsed.receiptDigest !== null)
  ) {
    reject(
      "INVALID_NA_RESULT",
      `${path} selection/outcome/receipt N/A state is inconsistent`,
      path,
    );
  }
  if (parsed.outcome === "passed" && parsed.receiptDigest === null) {
    reject("PASSED_WITHOUT_RECEIPT", `${path} passed outcome requires a receipt digest`, path);
  }
  return parsed;
}

function parseExperimentIdentityFields(
  value: Record<string, unknown>,
  path: string,
): ExperimentIdentity {
  return {
    architectureVersion: enumeration(
      value.architectureVersion,
      ["shadow-split", "cutover-split"],
      `${path}.architectureVersion`,
    ),
    commitSha: commitSha(value.commitSha, `${path}.commitSha`),
    runId: nonEmptyString(value.runId, `${path}.runId`),
    runAttempt: positiveInteger(value.runAttempt, `${path}.runAttempt`),
    profile: enumeration(value.profile, ["repo", "spine", "publish"], `${path}.profile`),
    manifestDigest: digest(value.manifestDigest, `${path}.manifestDigest`),
    inventoryDigest: digest(value.inventoryDigest, `${path}.inventoryDigest`),
    toolchainDigest: digest(value.toolchainDigest, `${path}.toolchainDigest`),
    inputDigest: digest(value.inputDigest, `${path}.inputDigest`),
    verificationExperimentId: nonEmptyString(
      value.verificationExperimentId,
      `${path}.verificationExperimentId`,
    ),
  };
}

export function parseExperimentIdentity(value: unknown, path = "identity"): ExperimentIdentity {
  const identity = record(value, path);
  exactKeys(
    identity,
    [
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
    ],
    path,
  );
  return parseExperimentIdentityFields(identity, path);
}

function parseIdentity(value: Record<string, unknown>, path: string): EvidenceIdentity {
  return {
    ...parseExperimentIdentityFields(value, path),
    lane: enumeration(value.lane, PRODUCER_LANES, `${path}.lane`),
  };
}

function identityMismatch(
  actual: EvidenceIdentity,
  expected: EvidenceIdentity,
  key: string,
): never | void {
  for (const field of [
    "architectureVersion",
    "commitSha",
    "runId",
    "runAttempt",
    "profile",
    "lane",
    "manifestDigest",
    "inventoryDigest",
    "toolchainDigest",
    "inputDigest",
    "verificationExperimentId",
  ] as const) {
    if (actual[field] !== expected[field]) {
      reject("IDENTITY_MISMATCH", `${key}.${field} does not match current-run identity`, key);
    }
  }
}

export function parseProducerBundle(value: unknown, path = "bundle"): ProducerBundle {
  const bundle = record(value, path);
  exactKeys(
    bundle,
    [
      "schemaVersion",
      "architectureVersion",
      "commitSha",
      "runId",
      "runAttempt",
      "profile",
      "lane",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
      "verificationExperimentId",
      "artifact",
      "startedAt",
      "completedAt",
      "status",
      "checks",
      "receipts",
      "attestations",
      "outputDigest",
      "bundleDigest",
    ],
    path,
  );
  if (bundle.schemaVersion !== PRODUCER_BUNDLE_SCHEMA) {
    reject(
      "INVALID_SCHEMA_VERSION",
      `${path}.schemaVersion must equal ${PRODUCER_BUNDLE_SCHEMA}`,
      path,
    );
  }
  const identity = parseIdentity(bundle, path);
  const artifactValue = record(bundle.artifact, `${path}.artifact`);
  exactKeys(artifactValue, ["name", "files", "digest"], `${path}.artifact`);
  const artifactFiles = parseOutputs(artifactValue.files, `${path}.artifact.files`);
  const artifact = {
    name: nonEmptyString(artifactValue.name, `${path}.artifact.name`),
    files: artifactFiles,
    digest: digest(artifactValue.digest, `${path}.artifact.digest`),
  };
  if (artifact.name !== expectedArtifactName(identity)) {
    reject(
      "ARTIFACT_IDENTITY_MISMATCH",
      `${path}.artifact.name does not match lane/run/attempt`,
      path,
    );
  }
  if (artifact.digest !== evidenceDigest(artifact.files)) {
    reject(
      "ARTIFACT_DIGEST_MISMATCH",
      `${path}.artifact.digest does not bind artifact files`,
      path,
    );
  }
  const startedAt = timestamp(bundle.startedAt, `${path}.startedAt`);
  const completedAt = timestamp(bundle.completedAt, `${path}.completedAt`);
  if (Date.parse(startedAt) > Date.parse(completedAt)) {
    reject("INVALID_TIME_RANGE", `${path}.startedAt must not be after completedAt`, path);
  }
  const checks = array(bundle.checks, `${path}.checks`).map((entry, index) =>
    parseCheckResult(entry, `${path}.checks[${index}]`),
  );
  const receipts = array(bundle.receipts, `${path}.receipts`).map((entry, index) =>
    parseReusableReceipt(entry, `${path}.receipts[${index}]`),
  );
  const attestations = array(bundle.attestations, `${path}.attestations`).map((entry, index) =>
    parseCurrentRunAttestation(entry, `${path}.attestations[${index}]`),
  );
  const parsed: ProducerBundle = {
    schemaVersion: PRODUCER_BUNDLE_SCHEMA,
    ...identity,
    artifact,
    startedAt,
    completedAt,
    status: enumeration(bundle.status, ["success", "failure"], `${path}.status`),
    checks,
    receipts,
    attestations,
    outputDigest: digest(bundle.outputDigest, `${path}.outputDigest`),
    bundleDigest: digest(bundle.bundleDigest, `${path}.bundleDigest`),
  };
  const ownedIds = [...checkIdsOwnedBy(parsed.lane)].sort();
  const checkIds = checks.map(({ id }) => id);
  assertUnique(checkIds, `${path}.checks ids`);
  if (JSON.stringify([...checkIds].sort()) !== JSON.stringify(ownedIds)) {
    reject(
      "OWNERSHIP_SET_MISMATCH",
      `${path}.checks must equal all IDs owned by ${parsed.lane}`,
      path,
    );
  }
  const receiptIds = receipts.map(({ checkId }) => checkId);
  const attestationIds = attestations.map(({ checkId }) => checkId);
  assertUnique(receiptIds, `${path}.receipts checkIds`);
  assertUnique(attestationIds, `${path}.attestations checkIds`);
  if (JSON.stringify([...attestationIds].sort()) !== JSON.stringify(ownedIds)) {
    reject("ATTESTATION_SET_MISMATCH", `${path}.attestations must cover all owned IDs`, path);
  }
  const receiptById = new Map(receipts.map((receipt) => [receipt.checkId, receipt]));
  const attestationById = new Map(
    attestations.map((attestation) => [attestation.checkId, attestation]),
  );
  for (const receipt of receipts) {
    for (const field of [
      "lane",
      "profile",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
    ] as const) {
      if (receipt[field] !== identity[field]) {
        reject(
          "RECEIPT_IDENTITY_MISMATCH",
          `${path} receipt ${receipt.checkId} mismatches ${field}`,
          path,
        );
      }
    }
  }
  for (const check of checks) {
    const receipt = receiptById.get(check.id);
    const attestation = attestationById.get(check.id);
    if (!attestation)
      reject("MISSING_ATTESTATION", `${path} missing attestation for ${check.id}`, path);
    for (const field of [
      "commitSha",
      "runId",
      "runAttempt",
      "profile",
      "lane",
      "manifestDigest",
      "inventoryDigest",
      "toolchainDigest",
      "inputDigest",
    ] as const) {
      if (attestation[field] !== identity[field]) {
        reject(
          "ATTESTATION_IDENTITY_MISMATCH",
          `${path} attestation ${check.id} mismatches ${field}`,
          path,
        );
      }
    }
    if (
      Date.parse(attestation.issuedAt) < Date.parse(startedAt) ||
      Date.parse(attestation.issuedAt) > Date.parse(completedAt)
    ) {
      reject(
        "STALE_ATTESTATION",
        `${path} attestation ${check.id} was not issued during this run`,
        path,
      );
    }
    if (
      check.outcome !== attestation.decision ||
      check.receiptDigest !== attestation.receiptDigest ||
      check.attestationDigest !== attestation.attestationDigest ||
      JSON.stringify(check.diagnostics) !== JSON.stringify(attestation.diagnostics)
    ) {
      reject(
        "CHECK_ATTESTATION_MISMATCH",
        `${path} result ${check.id} does not match its attestation`,
        path,
      );
    }
    if (check.receiptDigest !== null) {
      if (!receipt || receipt.receiptDigest !== check.receiptDigest) {
        reject(
          "CHECK_RECEIPT_MISMATCH",
          `${path} result ${check.id} does not match its receipt`,
          path,
        );
      }
      if (attestation.outputDigest !== evidenceDigest(receipt.outputs)) {
        reject(
          "ATTESTATION_OUTPUT_MISMATCH",
          `${path} attestation ${check.id} does not bind its receipt outputs`,
          path,
        );
      }
    } else if (receipt) {
      reject("UNEXPECTED_RECEIPT", `${path} result ${check.id} has an unexpected receipt`, path);
    }
  }
  const expectedStatus = checks.some(
    ({ semantics, outcome }) => semantics === "blocking" && outcome === "failed",
  )
    ? "failure"
    : "success";
  if (parsed.status !== expectedStatus) {
    reject("BUNDLE_STATUS_MISMATCH", `${path}.status does not match blocking check outcomes`, path);
  }
  const computedOutputDigest = evidenceDigest({
    artifactFiles: parsed.artifact.files,
    receiptOutputs: parsed.receipts.map(({ checkId, outputs }) => ({ checkId, outputs })),
  });
  if (parsed.outputDigest !== computedOutputDigest) {
    reject("OUTPUT_DIGEST_MISMATCH", `${path}.outputDigest does not bind exact outputs`, path);
  }
  const computedBundleDigest = evidenceDigest(
    withoutField(parsed as unknown as Record<string, unknown>, "bundleDigest"),
  );
  if (parsed.bundleDigest !== computedBundleDigest) {
    reject("BUNDLE_DIGEST_MISMATCH", `${path}.bundleDigest does not bind the bundle`, path);
  }
  return parsed;
}

export function createProducerBundle(
  value: Omit<ProducerBundle, "schemaVersion" | "artifact" | "outputDigest" | "bundleDigest"> & {
    readonly artifactFiles: readonly EvidenceOutput[];
  },
): ProducerBundle {
  const { artifactFiles, ...bundle } = value;
  const artifact = {
    name: expectedArtifactName(bundle),
    files: artifactFiles,
    digest: evidenceDigest(artifactFiles),
  };
  const outputDigest = evidenceDigest({
    artifactFiles,
    receiptOutputs: bundle.receipts.map(({ checkId, outputs }) => ({ checkId, outputs })),
  });
  const unsigned = {
    schemaVersion: PRODUCER_BUNDLE_SCHEMA,
    ...bundle,
    artifact,
    outputDigest,
  };
  return parseProducerBundle({ ...unsigned, bundleDigest: evidenceDigest(unsigned) });
}

export function validateProducerFanIn(
  values: readonly unknown[],
  expected: FanInExpectation,
): Readonly<Record<ProducerLane, ProducerBundle>> {
  const { selectedCheckIds, ...expectedIdentity } = expected;
  const producerCheckIds = PRODUCER_LANES.flatMap((lane) => [...checkIdsOwnedBy(lane)]);
  assertUnique(selectedCheckIds, "expected.selectedCheckIds");
  const unexpectedSelections = selectedCheckIds.filter(
    (checkId) => !producerCheckIds.includes(checkId as never),
  );
  if (unexpectedSelections.length > 0) {
    reject(
      "UNEXPECTED_SELECTED_CHECK",
      `selected check(s) are not producer-owned: ${unexpectedSelections.join(",")}`,
    );
  }
  const parsed = values.map((value, index) => parseProducerBundle(value, `fanIn[${index}]`));
  const lanes = parsed.map(({ lane }) => lane);
  assertUnique(lanes, "fanIn lanes");
  const missing = PRODUCER_LANES.filter((lane) => !lanes.includes(lane));
  const unexpected = lanes.filter((lane) => !PRODUCER_LANES.includes(lane));
  if (missing.length > 0) {
    reject("MISSING_PRODUCER_LANE", `fan-in is missing producer lane(s): ${missing.join(",")}`);
  }
  if (unexpected.length > 0 || parsed.length !== PRODUCER_LANES.length) {
    reject("UNEXPECTED_PRODUCER_LANE", `fan-in must contain exactly four producer bundles`);
  }
  for (const bundle of parsed) {
    identityMismatch(bundle, { ...expectedIdentity, lane: bundle.lane }, `fanIn.${bundle.lane}`);
    for (const check of bundle.checks) {
      const expectedSelection = selectedCheckIds.includes(check.id) ? "selected" : "not-applicable";
      if (check.selection !== expectedSelection) {
        reject(
          "SELECTION_MISMATCH",
          `producer ${bundle.lane} emitted ${check.id} as ${check.selection}; expected ${expectedSelection}`,
          check.id,
        );
      }
    }
  }
  return Object.fromEntries(parsed.map((bundle) => [bundle.lane, bundle])) as Record<
    ProducerLane,
    ProducerBundle
  >;
}

function stableDiagnostics(value: unknown, path: string): readonly string[] {
  const diagnostics = stringArray(value, path);
  if (JSON.stringify(diagnostics) !== JSON.stringify([...diagnostics].sort())) {
    reject("UNSTABLE_DIAGNOSTICS", `${path} must be sorted for deterministic evidence`, path);
  }
  return diagnostics;
}

function parseSynthesisCheckResult(value: unknown, path: string): SynthesisCheckResult {
  const result = record(value, path);
  exactKeys(result, ["id", "selection", "semantics", "outcome", "diagnostics"], path);
  const parsed: SynthesisCheckResult = {
    id: nonEmptyString(result.id, `${path}.id`),
    selection: enumeration(result.selection, ["selected", "not-applicable"], `${path}.selection`),
    semantics: enumeration(result.semantics, ["blocking", "advisory"], `${path}.semantics`),
    outcome: enumeration(result.outcome, ["passed", "failed", "not-applicable"], `${path}.outcome`),
    diagnostics: stableDiagnostics(result.diagnostics, `${path}.diagnostics`),
  };
  if ((parsed.selection === "not-applicable") !== (parsed.outcome === "not-applicable")) {
    reject("INVALID_NA_RESULT", `${path} selection and outcome N/A state must match`, path);
  }
  return parsed;
}

function parseSynthesisSecurityResult(value: unknown, path: string): SynthesisSecurityResult {
  const result = record(value, path);
  exactKeys(result, ["id", "owner", "semantics", "outcome", "diagnostics"], path);
  const ids = SECURITY_OWNERSHIP.map(({ id }) => id);
  const owners = SECURITY_OWNERSHIP.map(({ owner }) => owner);
  const semantics = SECURITY_OWNERSHIP.map(({ semantics }) => semantics);
  return {
    id: enumeration(result.id, ids, `${path}.id`),
    owner: enumeration(result.owner, owners, `${path}.owner`),
    semantics: enumeration(result.semantics, semantics, `${path}.semantics`),
    outcome: enumeration(result.outcome, ["passed", "failed", "not-applicable"], `${path}.outcome`),
    diagnostics: stableDiagnostics(result.diagnostics, `${path}.diagnostics`),
  };
}

function parseProducerBundleDigest(value: unknown, path: string): ProducerBundleDigest {
  const reference = record(value, path);
  exactKeys(reference, ["lane", "bundleDigest"], path);
  const lane = nonEmptyString(reference.lane, `${path}.lane`);
  if (!PRODUCER_LANES.includes(lane as ProducerLane)) {
    reject(
      "UNEXPECTED_PRODUCER_DIGEST",
      `${path}.lane is not one of the four producer lanes`,
      path,
    );
  }
  return {
    lane: lane as ProducerLane,
    bundleDigest: digest(reference.bundleDigest, `${path}.bundleDigest`),
  };
}

function splitIdentity(
  value: Record<string, unknown>,
  path: string,
): Omit<EvidenceIdentity, "lane"> {
  const identity = parseExperimentIdentityFields(value, path);
  if (identity.architectureVersion !== "shadow-split") {
    reject("INVALID_SHADOW_ARCHITECTURE", `${path}.architectureVersion must be shadow-split`, path);
  }
  return identity;
}

function expectedStableDiagnostics(
  checks: readonly SynthesisCheckResult[],
  security: readonly SynthesisSecurityResult[],
  operationalFailure: string | null,
): readonly string[] {
  return [
    ...new Set([
      ...checks.flatMap(({ diagnostics }) => diagnostics),
      ...security.flatMap(({ diagnostics }) => diagnostics),
      ...(operationalFailure === null ? [] : [operationalFailure]),
    ]),
  ].sort();
}

function synthesizedBlockingOutcome(
  checks: readonly SynthesisCheckResult[],
  security: readonly SynthesisSecurityResult[],
): "passed" | "failed" {
  return checks.some(
    ({ semantics, outcome }) => semantics === "blocking" && outcome === "failed",
  ) || security.some(({ semantics, outcome }) => semantics === "blocking" && outcome === "failed")
    ? "failed"
    : "passed";
}

export function parseSplitValidationShadowEvidence(
  value: unknown,
  expected: SplitValidationShadowExpectation,
  path = "splitValidationShadow",
): SplitValidationShadowEvidence {
  const evidence = record(value, path);
  exactKeys(
    evidence,
    [
      "schemaVersion",
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
      "lane",
      "reportPath",
      "artifactName",
      "producerBundles",
      "checks",
      "security",
      "blockingOutcome",
      "conclusion",
      "operationalFailure",
      "stableDiagnostics",
      "startedAt",
      "completedAt",
      "issuedAt",
      "fresh",
      "evidenceDigest",
    ],
    path,
  );
  if (evidence.schemaVersion !== SPLIT_VALIDATION_SHADOW_SCHEMA) {
    reject(
      "INVALID_SCHEMA_VERSION",
      `${path}.schemaVersion must equal ${SPLIT_VALIDATION_SHADOW_SCHEMA}`,
      path,
    );
  }
  if (evidence.lane !== "split-validation-shadow") {
    reject("INVALID_SYNTHESIS_LANE", `${path}.lane must be split-validation-shadow`, path);
  }
  const identity = splitIdentity(evidence, path);
  const reportPath = normalizePath(evidence.reportPath, `${path}.reportPath`);
  if (reportPath !== SPLIT_VALIDATION_SHADOW_REPORT_PATH) {
    reject("REPORT_PATH_MISMATCH", `${path}.reportPath is not the canonical report path`, path);
  }
  const artifactName = nonEmptyString(evidence.artifactName, `${path}.artifactName`);
  if (artifactName !== splitValidationShadowArtifactName(identity.runId, identity.runAttempt)) {
    reject(
      "ARTIFACT_IDENTITY_MISMATCH",
      `${path}.artifactName does not match the current run and attempt`,
      path,
    );
  }
  const producerBundles = array(evidence.producerBundles, `${path}.producerBundles`).map(
    (entry, index) => parseProducerBundleDigest(entry, `${path}.producerBundles[${index}]`),
  );
  const producerLanes = producerBundles.map(({ lane }) => lane);
  assertUnique(producerLanes, `${path}.producerBundles lanes`);
  const missingProducerLanes = PRODUCER_LANES.filter((lane) => !producerLanes.includes(lane));
  if (missingProducerLanes.length > 0) {
    reject(
      "MISSING_PRODUCER_DIGEST",
      `${path} is missing producer digest(s): ${missingProducerLanes.join(",")}`,
      path,
    );
  }
  if (producerBundles.length !== PRODUCER_LANES.length) {
    reject(
      "UNEXPECTED_PRODUCER_DIGEST",
      `${path} must bind exactly four producer bundle digests`,
      path,
    );
  }
  const expectedProducerBundles = expected.producerBundleDigests.map((entry, index) =>
    parseProducerBundleDigest(entry, `expected.producerBundleDigests[${index}]`),
  );
  const expectedProducerLanes = expectedProducerBundles.map(({ lane }) => lane);
  assertUnique(expectedProducerLanes, "expected.producerBundleDigests lanes");
  if (
    expectedProducerBundles.length !== PRODUCER_LANES.length ||
    PRODUCER_LANES.some((lane) => !expectedProducerLanes.includes(lane))
  ) {
    reject(
      "INVALID_EXPECTED_PRODUCER_DIGESTS",
      "expected producer bundle digests must contain exactly the four producer lanes",
    );
  }
  const expectedDigestByLane = new Map(
    expectedProducerBundles.map(({ lane, bundleDigest }) => [lane, bundleDigest]),
  );
  for (const reference of producerBundles) {
    if (reference.bundleDigest !== expectedDigestByLane.get(reference.lane)) {
      reject(
        "PRODUCER_DIGEST_MISMATCH",
        `${path}.${reference.lane} does not match the downloaded producer bundle`,
        reference.lane,
      );
    }
  }
  const checks = array(evidence.checks, `${path}.checks`).map((entry, index) =>
    parseSynthesisCheckResult(entry, `${path}.checks[${index}]`),
  );
  const checkIds = checks.map(({ id }) => id);
  assertUnique(checkIds, `${path}.checks ids`);
  if (JSON.stringify([...checkIds].sort()) !== JSON.stringify([...SYNTHESIZED_CHECK_IDS].sort())) {
    reject(
      "SYNTHESIZED_CHECK_SET_MISMATCH",
      `${path}.checks must contain all ${SYNTHESIZED_CHECK_IDS.length} check IDs`,
      path,
    );
  }
  assertUnique(expected.selectedCheckIds, "expected.selectedCheckIds");
  const unexpectedSelected = expected.selectedCheckIds.filter(
    (checkId) => !SYNTHESIZED_CHECK_IDS.includes(checkId as never),
  );
  if (unexpectedSelected.length > 0) {
    reject(
      "UNEXPECTED_SELECTED_CHECK",
      `selected check(s) are not manifest-owned: ${unexpectedSelected.join(",")}`,
    );
  }
  for (const check of checks) {
    const expectedSelection = expected.selectedCheckIds.includes(check.id)
      ? "selected"
      : "not-applicable";
    if (check.selection !== expectedSelection) {
      reject(
        "SELECTION_MISMATCH",
        `${path}.${check.id} is ${check.selection}; expected ${expectedSelection}`,
        check.id,
      );
    }
    const expectedSemantics = ADVISORY_CHECK_IDS.includes(check.id as never)
      ? "advisory"
      : "blocking";
    if (check.semantics !== expectedSemantics) {
      reject(
        "CHECK_SEMANTICS_MISMATCH",
        `${path}.${check.id} semantics must be ${expectedSemantics}`,
        check.id,
      );
    }
  }
  const security = array(evidence.security, `${path}.security`).map((entry, index) =>
    parseSynthesisSecurityResult(entry, `${path}.security[${index}]`),
  );
  const securityIds = security.map(({ id }) => id);
  assertUnique(securityIds, `${path}.security ids`);
  if (
    JSON.stringify([...securityIds].sort()) !==
    JSON.stringify(SECURITY_OWNERSHIP.map(({ id }) => id).sort())
  ) {
    reject("SECURITY_RESULT_SET_MISMATCH", `${path}.security must contain all five records`, path);
  }
  for (const result of security) {
    const owner = SECURITY_OWNERSHIP.find(({ id }) => id === result.id);
    if (!owner || owner.owner !== result.owner || owner.semantics !== result.semantics) {
      reject(
        "SECURITY_SEMANTICS_MISMATCH",
        `${path}.${result.id} owner or semantics drifted`,
        result.id,
      );
    }
  }
  const blockingOutcome = enumeration(
    evidence.blockingOutcome,
    ["passed", "failed"],
    `${path}.blockingOutcome`,
  );
  if (blockingOutcome !== synthesizedBlockingOutcome(checks, security)) {
    reject(
      "BLOCKING_OUTCOME_MISMATCH",
      `${path}.blockingOutcome does not match blocking results`,
      path,
    );
  }
  const conclusion = enumeration(
    evidence.conclusion,
    ["success", "failure", "cancelled", "skipped"],
    `${path}.conclusion`,
  );
  const operationalFailure =
    evidence.operationalFailure === null
      ? null
      : nonEmptyString(evidence.operationalFailure, `${path}.operationalFailure`);
  if (operationalFailure === null) {
    const expectedConclusion = blockingOutcome === "passed" ? "success" : "failure";
    if (conclusion !== expectedConclusion) {
      reject(
        "CONCLUSION_MISMATCH",
        `${path}.conclusion must be ${expectedConclusion} without an operational failure`,
        path,
      );
    }
  } else if (conclusion === "success") {
    reject(
      "OPERATIONAL_FAILURE_MASKED",
      `${path}.conclusion cannot be success with an operational failure`,
      path,
    );
  }
  const parsedStableDiagnostics = stableDiagnostics(
    evidence.stableDiagnostics,
    `${path}.stableDiagnostics`,
  );
  if (
    JSON.stringify(parsedStableDiagnostics) !==
    JSON.stringify(expectedStableDiagnostics(checks, security, operationalFailure))
  ) {
    reject(
      "STABLE_DIAGNOSTICS_MISMATCH",
      `${path}.stableDiagnostics must exactly aggregate result and operational diagnostics`,
      path,
    );
  }
  const startedAt = timestamp(evidence.startedAt, `${path}.startedAt`);
  const completedAt = timestamp(evidence.completedAt, `${path}.completedAt`);
  const issuedAt = timestamp(evidence.issuedAt, `${path}.issuedAt`);
  if (
    Date.parse(startedAt) > Date.parse(completedAt) ||
    Date.parse(issuedAt) < Date.parse(startedAt) ||
    Date.parse(issuedAt) > Date.parse(completedAt)
  ) {
    reject(
      "STALE_SYNTHESIS_EVIDENCE",
      `${path} must be issued within the current synthesis execution window`,
      path,
    );
  }
  const parsed: SplitValidationShadowEvidence = {
    schemaVersion: SPLIT_VALIDATION_SHADOW_SCHEMA,
    ...identity,
    lane: "split-validation-shadow",
    reportPath: SPLIT_VALIDATION_SHADOW_REPORT_PATH,
    artifactName,
    producerBundles,
    checks,
    security,
    blockingOutcome,
    conclusion,
    operationalFailure,
    stableDiagnostics: parsedStableDiagnostics,
    startedAt,
    completedAt,
    issuedAt,
    fresh:
      evidence.fresh === true
        ? true
        : reject("STALE_SYNTHESIS_EVIDENCE", `${path}.fresh must be true`, path),
    evidenceDigest: digest(evidence.evidenceDigest, `${path}.evidenceDigest`),
  };
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
    if (parsed[field] !== expected[field]) {
      reject(
        "SYNTHESIS_IDENTITY_MISMATCH",
        `${path}.${field} does not match current-run identity`,
        path,
      );
    }
  }
  const computedDigest = evidenceDigest(
    withoutField(parsed as unknown as Record<string, unknown>, "evidenceDigest"),
  );
  if (computedDigest !== parsed.evidenceDigest) {
    reject(
      "SYNTHESIS_EVIDENCE_DIGEST_MISMATCH",
      `${path}.evidenceDigest does not bind the complete report`,
      path,
    );
  }
  return parsed;
}

export function createSplitValidationShadowEvidence(
  value: Omit<
    SplitValidationShadowEvidence,
    | "schemaVersion"
    | "lane"
    | "reportPath"
    | "artifactName"
    | "blockingOutcome"
    | "stableDiagnostics"
    | "fresh"
    | "evidenceDigest"
  >,
): SplitValidationShadowEvidence {
  const blockingOutcome = synthesizedBlockingOutcome(value.checks, value.security);
  const stableDiagnostics = expectedStableDiagnostics(
    value.checks,
    value.security,
    value.operationalFailure,
  );
  const unsigned = {
    schemaVersion: SPLIT_VALIDATION_SHADOW_SCHEMA,
    ...value,
    lane: "split-validation-shadow" as const,
    reportPath: SPLIT_VALIDATION_SHADOW_REPORT_PATH,
    artifactName: splitValidationShadowArtifactName(value.runId, value.runAttempt),
    blockingOutcome,
    stableDiagnostics,
    fresh: true as const,
  };
  return parseSplitValidationShadowEvidence(
    { ...unsigned, evidenceDigest: evidenceDigest(unsigned) },
    {
      architectureVersion: value.architectureVersion,
      commitSha: value.commitSha,
      runId: value.runId,
      runAttempt: value.runAttempt,
      profile: value.profile,
      manifestDigest: value.manifestDigest,
      inventoryDigest: value.inventoryDigest,
      toolchainDigest: value.toolchainDigest,
      inputDigest: value.inputDigest,
      verificationExperimentId: value.verificationExperimentId,
      selectedCheckIds: value.checks
        .filter(({ selection }) => selection === "selected")
        .map(({ id }) => id),
      producerBundleDigests: value.producerBundles,
    },
  );
}

export function formatCiLaneEvidenceError(error: unknown): string {
  if (error instanceof CiLaneEvidenceError) {
    return `${error.code}${error.key ? ` [${error.key}]` : ""}: ${error.message}`;
  }
  return `UNEXPECTED_EVIDENCE_ERROR: ${error instanceof Error ? error.message : String(error)}`;
}
