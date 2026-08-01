import { Problem, ProblemCategory } from "@croco/problems-core";

import type { TestKernelFidelity, TestKernelResourceEvidence } from "./TestKernel";

export const TEST_EVIDENCE_SCHEMA_VERSION = "croco.test-evidence/v1" as const;

export type TestEvidenceJsonValue =
  | boolean
  | number
  | string
  | null
  | readonly TestEvidenceJsonValue[]
  | { readonly [key: string]: TestEvidenceJsonValue };

export type TestEvidenceOutcome = "passed" | "failed" | "flaky" | "skipped";
export type TestEvidenceAttemptOutcome = Exclude<TestEvidenceOutcome, "flaky">;
export type TestEvidenceRunner =
  | "vitest"
  | "playwright"
  | "provider-conformance"
  | "failure-drill"
  | "generated-app"
  | "runtime-smoke"
  | "croco-verification"
  | "custom";

export type TestEvidenceFidelity = {
  readonly boot: "isolated" | "application" | "adapter";
  readonly dependency: "fake" | "local-real" | "remote-real";
  readonly isolation: "fake" | "rollback" | "commit" | "migration";
  readonly runtime: "node" | "lambda" | "cloudflare" | "browser";
  readonly validation: "isolated" | "production" | "overridden";
};

export type TestEvidenceIntent = {
  readonly contractIds: readonly string[];
  readonly description: string;
};

export type TestEvidenceObservation = {
  readonly contractIds: readonly string[];
  readonly eventIds?: readonly string[];
  readonly problemCodes?: readonly string[];
  readonly routeIds?: readonly string[];
};

export type TestEvidenceReplay = {
  readonly command: string;
  readonly seed?: string;
  readonly virtualTime?: string;
};

export type TestEvidenceDiagnostic = {
  readonly code: string;
  readonly recoveryAction: string;
};

export type TestEvidenceAttachment = {
  readonly kind: "contract" | "coverage" | "log" | "report" | "screenshot" | "trace";
  readonly path: string;
  readonly schemaVersion?: string;
};

export type TestEvidenceAttempt = {
  readonly attachments?: readonly TestEvidenceAttachment[];
  readonly attempt: number;
  readonly diagnostics?: readonly TestEvidenceDiagnostic[];
  readonly durationMs?: number;
  readonly outcome: TestEvidenceAttemptOutcome;
};

export type TestEvidenceResourceStatus = {
  readonly leaks: readonly string[];
  readonly status: "clean" | "leaked" | "not-checked";
};

export type TestEvidenceTiming = {
  readonly durationMs?: number;
};

export type TestEvidenceRecord = {
  readonly schemaVersion: typeof TEST_EVIDENCE_SCHEMA_VERSION;
  readonly id: string;
  readonly runner: TestEvidenceRunner;
  readonly outcome: TestEvidenceOutcome;
  readonly intent: TestEvidenceIntent;
  readonly observed: TestEvidenceObservation;
  readonly fidelity: TestEvidenceFidelity;
  readonly replay: TestEvidenceReplay;
  readonly diagnostics: readonly TestEvidenceDiagnostic[];
  readonly attempts: readonly TestEvidenceAttempt[];
  readonly resources: TestEvidenceResourceStatus;
  readonly attachments: readonly TestEvidenceAttachment[];
  readonly timing?: TestEvidenceTiming;
  readonly metadata?: Readonly<Record<string, TestEvidenceJsonValue>>;
};

export type TestEvidenceRecordInput = Omit<
  TestEvidenceRecord,
  "schemaVersion" | "outcome" | "diagnostics" | "attachments"
> & {
  readonly attachments?: readonly TestEvidenceAttachment[];
  readonly diagnostics?: readonly TestEvidenceDiagnostic[];
};

export type TestKernelEvidenceRecordInput = Omit<TestEvidenceRecordInput, "fidelity"> & {
  readonly kernelFidelity: TestKernelFidelity;
  readonly resourceEvidence?: readonly TestKernelResourceEvidence[];
};

export type TestEvidenceBundle = {
  readonly schemaVersion: typeof TEST_EVIDENCE_SCHEMA_VERSION;
  readonly missingArtifacts: readonly TestEvidenceMissingArtifact[];
  readonly records: readonly TestEvidenceRecord[];
  readonly status: "passed" | "failed";
  readonly summary: {
    readonly failed: number;
    readonly flaky: number;
    readonly passed: number;
    readonly skipped: number;
    readonly total: number;
  };
};

export type TestEvidenceMissingArtifact = {
  readonly path: string;
  readonly recordId: string;
  readonly required: true;
};

export type TestEvidenceArtifactProbe = (path: string) => boolean;

export type TestEvidenceFidelityRequirement = Partial<TestEvidenceFidelity>;

const SENSITIVE_KEY =
  /(?:authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|dsn)/i;
const SECRET_LIKE_VALUE =
  /(?:(?:authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|dsn)\s*[:=]\s*[^\s,;&]+|\b(?:bearer|basic|digest|apikey)\s+[^\s,;]+)/gi;
const STRUCTURED_SECRET_VALUE =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|\bgithub_pat_[a-zA-Z0-9_]{20,}\b|\bgh[pousr]_[a-zA-Z0-9]{20,}\b|\bAKIA[A-Z0-9]{16}\b|\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b)/g;
const REDACTED = "[Redacted]";
const ATTACHMENT_KINDS = ["contract", "coverage", "log", "report", "screenshot", "trace"] as const;
const ATTEMPT_OUTCOMES = ["passed", "failed", "skipped"] as const;
const RUNNERS = [
  "vitest",
  "playwright",
  "provider-conformance",
  "failure-drill",
  "generated-app",
  "runtime-smoke",
  "croco-verification",
  "custom",
] as const;

export class TestEvidenceContractError extends Problem {
  readonly code = "CROCO_TEST_EVIDENCE_CONTRACT_INVALID";

  constructor(detail: string, cause?: unknown) {
    super(
      "CROCO_TEST_EVIDENCE_CONTRACT_INVALID",
      ProblemCategory.ValidationError,
      `CROCO_TEST_EVIDENCE_CONTRACT_INVALID: ${detail}`,
      cause === undefined ? undefined : { cause: toError(cause) },
    );
    this.name = "TestEvidenceContractError";
  }
}

export class TestEvidenceFidelityError extends Problem {
  readonly code = "CROCO_TEST_EVIDENCE_FIDELITY_UNSATISFIED";

  constructor(record: TestEvidenceRecord, field: keyof TestEvidenceFidelity, expected: string) {
    super(
      "CROCO_TEST_EVIDENCE_FIDELITY_UNSATISFIED",
      ProblemCategory.ValidationError,
      `CROCO_TEST_EVIDENCE_FIDELITY_UNSATISFIED: Evidence '${record.id}' observed ${field} '${record.fidelity[field]}', not required '${expected}'. Rerun at the required fidelity instead of relabeling the evidence.`,
    );
    this.name = "TestEvidenceFidelityError";
  }
}

export function createTestEvidenceRecord(input: TestEvidenceRecordInput): TestEvidenceRecord {
  if (!isRecord(input)) {
    throw new TestEvidenceContractError("Evidence record input must be an object.");
  }
  assertNonEmpty(input.id, "Evidence id");
  if (!isRecord(input.intent)) {
    throw new TestEvidenceContractError(`Evidence '${String(input.id)}' intent must be an object.`);
  }
  if (!isRecord(input.observed)) {
    throw new TestEvidenceContractError(
      `Evidence '${String(input.id)}' observation must be an object.`,
    );
  }
  if (!isRecord(input.replay)) {
    throw new TestEvidenceContractError(`Evidence '${String(input.id)}' replay must be an object.`);
  }
  if (!Array.isArray(input.attempts)) {
    throw new TestEvidenceContractError(
      `Evidence '${String(input.id)}' attempts must be an array.`,
    );
  }
  assertNonEmpty(input.intent.description, `Evidence '${input.id}' intent description`);
  assertNonEmpty(input.replay.command, `Evidence '${input.id}' replay command`);
  assertStableIds(input.intent.contractIds, `Evidence '${input.id}' declared contract`);
  assertStableIds(input.observed.contractIds, `Evidence '${input.id}' observed contract`);
  const attempts = [...input.attempts].sort((left, right) => left.attempt - right.attempt);
  assertAttempts(input.id, attempts);
  const outcome = classifyTestEvidenceOutcome(attempts);
  const diagnostics = input.diagnostics ?? attempts.flatMap((attempt) => attempt.diagnostics ?? []);
  const attachments = input.attachments ?? attempts.flatMap((attempt) => attempt.attachments ?? []);
  const record = redactTestEvidence(
    normalizeTestEvidenceRecord({
      ...input,
      schemaVersion: TEST_EVIDENCE_SCHEMA_VERSION,
      outcome,
      diagnostics,
      attachments,
      attempts,
    }),
  );
  assertTestEvidenceRecord(record);
  return deepFreeze(record);
}

export function createTestKernelEvidenceRecord(
  input: TestKernelEvidenceRecordInput,
): TestEvidenceRecord {
  const { kernelFidelity, resourceEvidence = [], ...record } = input;
  return createTestEvidenceRecord({
    ...record,
    fidelity: testEvidenceFidelityFromKernel(kernelFidelity, resourceEvidence),
  });
}

export function testEvidenceFidelityFromKernel(
  kernel: TestKernelFidelity,
  resources: readonly TestKernelResourceEvidence[] = [],
): TestEvidenceFidelity {
  const modes = resources.map(({ fidelity }) => fidelity.mode);
  if (new Set(modes).size > 1) {
    throw new TestEvidenceContractError(
      `TestKernel resource evidence mixes isolation modes (${sortStrings(modes).join(", ")}); emit one evidence record per fidelity instead of promoting the combined result.`,
    );
  }
  const isolation = modes.includes("migration")
    ? "migration"
    : modes.includes("commit")
      ? "commit"
      : modes.includes("rollback")
        ? "rollback"
        : "fake";
  return {
    boot: kernel.boot,
    dependency: resources.length > 0 ? "local-real" : "fake",
    isolation,
    runtime: kernel.runtime,
    validation: kernel.validation,
  };
}

export function classifyTestEvidenceOutcome(
  attempts: readonly TestEvidenceAttempt[],
): TestEvidenceOutcome {
  if (attempts.length === 0) {
    throw new TestEvidenceContractError("Evidence must retain at least one attempt.");
  }
  const chronologicalAttempts = [...attempts].sort((left, right) => left.attempt - right.attempt);
  const finalAttempt = chronologicalAttempts.at(-1);
  if (!finalAttempt) {
    throw new TestEvidenceContractError("Evidence final attempt is missing.");
  }
  if (
    finalAttempt.outcome === "passed" &&
    chronologicalAttempts.some(({ outcome }) => outcome === "failed")
  ) {
    return "flaky";
  }
  return finalAttempt.outcome;
}

export function assertTestEvidenceRecord(value: unknown): asserts value is TestEvidenceRecord {
  if (!isRecord(value)) {
    throw new TestEvidenceContractError("Evidence record must be an object.");
  }
  assertAllowedKeys(
    value,
    [
      "schemaVersion",
      "id",
      "runner",
      "outcome",
      "intent",
      "observed",
      "fidelity",
      "replay",
      "diagnostics",
      "attempts",
      "resources",
      "attachments",
      "timing",
      "metadata",
    ],
    "Evidence record",
  );
  const record = value as Partial<TestEvidenceRecord>;
  if (record.schemaVersion !== TEST_EVIDENCE_SCHEMA_VERSION) {
    throw new TestEvidenceContractError(
      `Expected schemaVersion '${TEST_EVIDENCE_SCHEMA_VERSION}'.`,
    );
  }
  assertNonEmpty(record.id, "Evidence id");
  assertEnum(record.runner, RUNNERS, `Evidence '${record.id}' runner`);
  const attempts = Array.isArray(record.attempts)
    ? [...record.attempts].sort((left, right) => {
        const leftAttempt = isRecord(left) ? left["attempt"] : undefined;
        const rightAttempt = isRecord(right) ? right["attempt"] : undefined;
        return typeof leftAttempt === "number" && typeof rightAttempt === "number"
          ? leftAttempt - rightAttempt
          : 0;
      })
    : record.attempts;
  assertAttempts(record.id, attempts);
  const classified = classifyTestEvidenceOutcome(attempts);
  if (record.outcome !== classified) {
    throw new TestEvidenceContractError(
      `Evidence '${record.id}' outcome '${String(record.outcome)}' does not match attempt-derived '${classified}'.`,
    );
  }
  const intent = record.intent;
  const observed = record.observed;
  if (!isRecord(intent) || !isRecord(observed)) {
    throw new TestEvidenceContractError(
      `Evidence '${record.id}' must keep intent and observed contracts as separate objects.`,
    );
  }
  assertAllowedKeys(intent, ["contractIds", "description"], `Evidence '${record.id}' intent`);
  assertAllowedKeys(
    observed,
    ["contractIds", "eventIds", "problemCodes", "routeIds"],
    `Evidence '${record.id}' observation`,
  );
  if (intent === observed) {
    throw new TestEvidenceContractError(
      `Evidence '${record.id}' cannot reuse its declared intent object as runtime observation.`,
    );
  }
  const typedIntent = intent as Partial<TestEvidenceIntent>;
  const typedObserved = observed as Partial<TestEvidenceObservation>;
  assertNonEmpty(typedIntent.description, `Evidence '${record.id}' intent description`);
  assertStringIds(typedIntent.contractIds, `Evidence '${record.id}' declared contract`);
  assertStringIds(typedObserved.contractIds, `Evidence '${record.id}' observed contract`);
  for (const field of ["eventIds", "problemCodes", "routeIds"] as const) {
    if (typedObserved[field] !== undefined) {
      assertStringIds(typedObserved[field], `Evidence '${record.id}' observed ${field}`);
    }
  }
  assertFidelity(record.id, record.fidelity);
  if (!isRecord(record.replay)) {
    throw new TestEvidenceContractError(`Evidence '${record.id}' replay must be an object.`);
  }
  assertAllowedKeys(
    record.replay,
    ["command", "seed", "virtualTime"],
    `Evidence '${record.id}' replay`,
  );
  const replay = record.replay as Partial<TestEvidenceReplay>;
  assertNonEmpty(replay.command, `Evidence '${record.id}' replay command`);
  for (const field of ["seed", "virtualTime"] as const) {
    if (replay[field] !== undefined && typeof replay[field] !== "string") {
      throw new TestEvidenceContractError(
        `Evidence '${record.id}' replay ${field} must be a string.`,
      );
    }
  }
  assertDiagnostics(record.id, record.diagnostics, "diagnostics");
  assertAttachments(record.id, record.attachments, "attachments");
  assertResources(record.id, record.resources);
  if (record.timing !== undefined) {
    if (!isRecord(record.timing)) {
      throw new TestEvidenceContractError(`Evidence '${record.id}' timing must be an object.`);
    }
    assertAllowedKeys(record.timing, ["durationMs"], `Evidence '${record.id}' timing`);
    const timing = record.timing as Partial<TestEvidenceTiming>;
    assertDuration(record.id, timing.durationMs, "timing");
  }
  if (record.metadata !== undefined) {
    if (!isRecord(record.metadata) || !isJsonValue(record.metadata)) {
      throw new TestEvidenceContractError(`Evidence '${record.id}' metadata must be JSON-safe.`);
    }
  }
}

export function assertTestEvidenceBundle(value: unknown): asserts value is TestEvidenceBundle {
  if (!isRecord(value)) {
    throw new TestEvidenceContractError("Evidence bundle must be an object.");
  }
  assertAllowedKeys(
    value,
    ["schemaVersion", "missingArtifacts", "records", "status", "summary"],
    "Evidence bundle",
  );
  const bundle = value as Partial<TestEvidenceBundle>;
  if (bundle.schemaVersion !== TEST_EVIDENCE_SCHEMA_VERSION) {
    throw new TestEvidenceContractError(
      `Expected bundle schemaVersion '${TEST_EVIDENCE_SCHEMA_VERSION}'.`,
    );
  }
  if (!Array.isArray(bundle.records)) {
    throw new TestEvidenceContractError("Evidence bundle records must be an array.");
  }
  bundle.records.forEach(assertTestEvidenceRecord);
  const ids = bundle.records.map(({ id }) => id);
  const recordIds = new Set(ids);
  if (recordIds.size !== ids.length) {
    throw new TestEvidenceContractError("Evidence bundle record IDs must be unique.");
  }
  if (!Array.isArray(bundle.missingArtifacts)) {
    throw new TestEvidenceContractError("Evidence bundle missingArtifacts must be an array.");
  }
  bundle.missingArtifacts.forEach((missing, index) => {
    if (!isRecord(missing)) {
      throw new TestEvidenceContractError(
        `Evidence bundle missingArtifacts[${index}] must be an object.`,
      );
    }
    assertAllowedKeys(
      missing,
      ["path", "recordId", "required"],
      `Evidence bundle missingArtifacts[${index}]`,
    );
    const artifact = missing as Partial<TestEvidenceMissingArtifact>;
    assertNonEmpty(artifact.path, `Evidence bundle missingArtifacts[${index}] path`);
    assertNonEmpty(artifact.recordId, `Evidence bundle missingArtifacts[${index}] recordId`);
    if (typeof artifact.recordId === "string" && !recordIds.has(artifact.recordId)) {
      throw new TestEvidenceContractError(
        `Evidence bundle missingArtifacts[${index}] references unknown record '${artifact.recordId}'.`,
      );
    }
    if (artifact.required !== true) {
      throw new TestEvidenceContractError(
        `Evidence bundle missingArtifacts[${index}] must be required.`,
      );
    }
  });
  if (!isRecord(bundle.summary)) {
    throw new TestEvidenceContractError("Evidence bundle summary must be an object.");
  }
  assertAllowedKeys(
    bundle.summary,
    ["failed", "flaky", "passed", "skipped", "total"],
    "Evidence bundle summary",
  );
  const expectedSummary = summarizeRecords(bundle.records);
  for (const field of ["failed", "flaky", "passed", "skipped", "total"] as const) {
    if (bundle.summary[field] !== expectedSummary[field]) {
      throw new TestEvidenceContractError(
        `Evidence bundle summary ${field} '${String(bundle.summary[field])}' does not match derived '${expectedSummary[field]}'.`,
      );
    }
  }
  const expectedStatus = deriveBundleStatus(expectedSummary, bundle.missingArtifacts.length);
  if (bundle.status !== expectedStatus) {
    throw new TestEvidenceContractError(
      `Evidence bundle status '${String(bundle.status)}' does not match derived '${expectedStatus}'.`,
    );
  }
}

export function assertTestEvidenceFidelity(
  record: TestEvidenceRecord,
  requirement: TestEvidenceFidelityRequirement,
): void {
  for (const field of Object.keys(requirement) as Array<keyof TestEvidenceFidelity>) {
    const expected = requirement[field];
    if (expected !== undefined && record.fidelity[field] !== expected) {
      throw new TestEvidenceFidelityError(record, field, expected);
    }
  }
}

export function createTestEvidenceBundle(
  records: readonly TestEvidenceRecord[],
  artifactExists: TestEvidenceArtifactProbe = () => true,
): TestEvidenceBundle {
  const sortedRecords = records
    .map((record) => {
      assertTestEvidenceRecord(record);
      return deepFreeze(redactTestEvidence(normalizeTestEvidenceRecord(record)));
    })
    .sort((left, right) => compareStrings(left.id, right.id));
  const duplicate = sortedRecords.find(({ id }, index) => sortedRecords[index - 1]?.id === id);
  if (duplicate) {
    throw new TestEvidenceContractError(`Evidence bundle duplicates id '${duplicate.id}'.`);
  }
  const missingArtifacts = sortedRecords.flatMap((record) =>
    record.attachments
      .filter(({ path }) => !artifactExists(path))
      .map(({ path }) => ({ path, recordId: record.id, required: true as const })),
  );
  const summary = summarizeRecords(sortedRecords);
  return deepFreeze({
    schemaVersion: TEST_EVIDENCE_SCHEMA_VERSION,
    missingArtifacts,
    records: sortedRecords,
    status: deriveBundleStatus(summary, missingArtifacts.length),
    summary,
  });
}

function summarizeRecords(records: readonly TestEvidenceRecord[]): TestEvidenceBundle["summary"] {
  return {
    failed: records.filter(({ outcome }) => outcome === "failed").length,
    flaky: records.filter(({ outcome }) => outcome === "flaky").length,
    passed: records.filter(({ outcome }) => outcome === "passed").length,
    skipped: records.filter(({ outcome }) => outcome === "skipped").length,
    total: records.length,
  };
}

function deriveBundleStatus(
  summary: TestEvidenceBundle["summary"],
  missingArtifactCount: number,
): TestEvidenceBundle["status"] {
  return summary.failed > 0 || summary.flaky > 0 || missingArtifactCount > 0 ? "failed" : "passed";
}

function normalizeTestEvidenceRecord(record: TestEvidenceRecord): TestEvidenceRecord {
  return {
    ...record,
    intent: { ...record.intent, contractIds: sortStrings(record.intent.contractIds) },
    observed: {
      ...record.observed,
      contractIds: sortStrings(record.observed.contractIds),
      ...(record.observed.eventIds ? { eventIds: sortStrings(record.observed.eventIds) } : {}),
      ...(record.observed.problemCodes
        ? { problemCodes: sortStrings(record.observed.problemCodes) }
        : {}),
      ...(record.observed.routeIds ? { routeIds: sortStrings(record.observed.routeIds) } : {}),
    },
    diagnostics: sortDiagnostics(record.diagnostics),
    attempts: [...record.attempts]
      .sort((left, right) => left.attempt - right.attempt)
      .map((attempt) => ({
        ...attempt,
        ...(attempt.attachments ? { attachments: sortAttachments(attempt.attachments) } : {}),
        ...(attempt.diagnostics ? { diagnostics: sortDiagnostics(attempt.diagnostics) } : {}),
      })),
    resources: { ...record.resources, leaks: sortStrings(record.resources.leaks) },
    attachments: sortAttachments(record.attachments),
  };
}

function sortAttachments(
  attachments: readonly TestEvidenceAttachment[],
): readonly TestEvidenceAttachment[] {
  return [...attachments].sort((left, right) =>
    compareStrings(
      `${left.kind}\u0000${left.path}\u0000${left.schemaVersion ?? ""}`,
      `${right.kind}\u0000${right.path}\u0000${right.schemaVersion ?? ""}`,
    ),
  );
}

function sortDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[],
): readonly TestEvidenceDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    compareStrings(
      `${left.code}\u0000${left.recoveryAction}`,
      `${right.code}\u0000${right.recoveryAction}`,
    ),
  );
}

function sortStrings(values: readonly string[]): readonly string[] {
  return [...values].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function serializeTestEvidence(value: TestEvidenceBundle | TestEvidenceRecord): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

export function renderTestEvidenceMarkdown(bundle: TestEvidenceBundle): string {
  const lines = [
    "# Croco test evidence",
    "",
    `- Schema: \`${bundle.schemaVersion}\``,
    `- Status: **${bundle.status}**`,
    `- Records: ${bundle.summary.total} (${bundle.summary.passed} passed, ${bundle.summary.failed} failed, ${bundle.summary.flaky} flaky, ${bundle.summary.skipped} skipped)`,
    `- Missing artifacts: ${bundle.missingArtifacts.length}`,
    "",
    "| ID | Runner | Outcome | Boot | Dependency | Runtime | Isolation | Attempts |",
    "| --- | --- | --- | --- | --- | --- | --- | ---: |",
    ...bundle.records.map(
      (record) =>
        `| ${escapeMarkdown(record.id)} | ${record.runner} | ${record.outcome} | ${record.fidelity.boot} | ${record.fidelity.dependency} | ${record.fidelity.runtime} | ${record.fidelity.isolation} | ${record.attempts.length} |`,
    ),
  ];
  if (bundle.missingArtifacts.length > 0) {
    lines.push("", "## Missing artifacts", "");
    for (const missing of bundle.missingArtifacts) {
      lines.push(
        `- Record ID: ${escapeMarkdown(missing.recordId)}; path: ${escapeMarkdown(missing.path)}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function redactTestEvidence<T>(value: T): T {
  return redactValue(value, "", new WeakSet()) as T;
}

export function assertNoTestEvidenceSecrets(
  value: unknown,
  secretSamples: readonly string[],
): void {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TestEvidenceContractError("Evidence must be JSON-serializable.", error);
  }
  if (typeof serialized !== "string") {
    throw new TestEvidenceContractError("Evidence must serialize to a JSON value.");
  }
  for (const sample of secretSamples) {
    if (sample && serialized.includes(sample)) {
      throw new TestEvidenceContractError("Evidence contains a configured secret sample.");
    }
  }
}

function assertAttempts(
  id: unknown,
  value: unknown,
): asserts value is readonly TestEvidenceAttempt[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TestEvidenceContractError(`Evidence '${String(id)}' requires at least one attempt.`);
  }
  value.forEach((attempt, index) => {
    if (!isRecord(attempt)) {
      throw new TestEvidenceContractError(
        `Evidence '${String(id)}' attempt ${index + 1} must be an object.`,
      );
    }
    const typedAttempt = attempt as Partial<TestEvidenceAttempt>;
    assertAllowedKeys(
      attempt,
      ["attachments", "attempt", "diagnostics", "durationMs", "outcome"],
      `Evidence '${String(id)}' attempt ${index + 1}`,
    );
    if (typedAttempt.attempt !== index + 1) {
      throw new TestEvidenceContractError(
        `Evidence '${String(id)}' attempts must be contiguous and one-based; received ${typedAttempt.attempt} at index ${index}.`,
      );
    }
    assertEnum(typedAttempt.outcome, ATTEMPT_OUTCOMES, `Evidence '${String(id)}' attempt outcome`);
    assertDuration(id, typedAttempt.durationMs, `attempt ${typedAttempt.attempt}`);
    if (typedAttempt.diagnostics !== undefined) {
      assertDiagnostics(
        id,
        typedAttempt.diagnostics,
        `attempt ${typedAttempt.attempt} diagnostics`,
      );
    }
    if (typedAttempt.attachments !== undefined) {
      assertAttachments(
        id,
        typedAttempt.attachments,
        `attempt ${typedAttempt.attempt} attachments`,
      );
    }
  });
}

function assertFidelity(id: string, value: unknown): asserts value is TestEvidenceFidelity {
  if (!isRecord(value)) {
    throw new TestEvidenceContractError(`Evidence '${id}' fidelity must be an object.`);
  }
  const fidelity = value as Partial<TestEvidenceFidelity>;
  assertAllowedKeys(
    value,
    ["boot", "dependency", "isolation", "runtime", "validation"],
    `Evidence '${id}' fidelity`,
  );
  assertEnum(
    fidelity.boot,
    ["isolated", "application", "adapter"] as const,
    `Evidence '${id}' fidelity boot`,
  );
  assertEnum(
    fidelity.dependency,
    ["fake", "local-real", "remote-real"] as const,
    `Evidence '${id}' fidelity dependency`,
  );
  assertEnum(
    fidelity.isolation,
    ["fake", "rollback", "commit", "migration"] as const,
    `Evidence '${id}' fidelity isolation`,
  );
  assertEnum(
    fidelity.runtime,
    ["node", "lambda", "cloudflare", "browser"] as const,
    `Evidence '${id}' fidelity runtime`,
  );
  assertEnum(
    fidelity.validation,
    ["isolated", "production", "overridden"] as const,
    `Evidence '${id}' fidelity validation`,
  );
}

function assertResources(id: string, value: unknown): asserts value is TestEvidenceResourceStatus {
  const resources = isRecord(value) ? (value as Partial<TestEvidenceResourceStatus>) : undefined;
  if (
    !resources ||
    !Array.isArray(resources.leaks) ||
    resources.leaks.some((leak) => typeof leak !== "string")
  ) {
    throw new TestEvidenceContractError(`Evidence '${id}' resources must include string leak IDs.`);
  }
  assertAllowedKeys(
    value as Record<string, unknown>,
    ["leaks", "status"],
    `Evidence '${id}' resources`,
  );
  assertEnum(
    resources.status,
    ["clean", "leaked", "not-checked"] as const,
    `Evidence '${id}' resource status`,
  );
}

function assertDiagnostics(
  id: unknown,
  value: unknown,
  label: string,
): asserts value is readonly TestEvidenceDiagnostic[] {
  if (!Array.isArray(value)) {
    throw new TestEvidenceContractError(`Evidence '${String(id)}' ${label} must be an array.`);
  }
  value.forEach((diagnostic, index) => {
    if (!isRecord(diagnostic)) {
      throw new TestEvidenceContractError(
        `Evidence '${String(id)}' ${label}[${index}] must be an object.`,
      );
    }
    const typedDiagnostic = diagnostic as Partial<TestEvidenceDiagnostic>;
    assertAllowedKeys(
      diagnostic,
      ["code", "recoveryAction"],
      `Evidence '${String(id)}' ${label}[${index}]`,
    );
    assertNonEmpty(typedDiagnostic.code, `Evidence '${String(id)}' ${label}[${index}] code`);
    assertNonEmpty(
      typedDiagnostic.recoveryAction,
      `Evidence '${String(id)}' ${label}[${index}] recovery action`,
    );
  });
}

function assertAttachments(
  id: unknown,
  value: unknown,
  label: string,
): asserts value is readonly TestEvidenceAttachment[] {
  if (!Array.isArray(value)) {
    throw new TestEvidenceContractError(`Evidence '${String(id)}' ${label} must be an array.`);
  }
  value.forEach((attachment, index) => {
    if (!isRecord(attachment)) {
      throw new TestEvidenceContractError(
        `Evidence '${String(id)}' ${label}[${index}] must be an object.`,
      );
    }
    const typedAttachment = attachment as Partial<TestEvidenceAttachment>;
    assertAllowedKeys(
      attachment,
      ["kind", "path", "schemaVersion"],
      `Evidence '${String(id)}' ${label}[${index}]`,
    );
    assertEnum(
      typedAttachment.kind,
      ATTACHMENT_KINDS,
      `Evidence '${String(id)}' ${label}[${index}] kind`,
    );
    assertNonEmpty(typedAttachment.path, `Evidence '${String(id)}' ${label}[${index}] path`);
    if (typedAttachment.schemaVersion !== undefined) {
      assertNonEmpty(
        typedAttachment.schemaVersion,
        `Evidence '${String(id)}' ${label}[${index}] schema version`,
      );
    }
  });
}

function assertStringIds(value: unknown, label: string): asserts value is readonly string[] {
  if (!Array.isArray(value)) {
    throw new TestEvidenceContractError(`${label} IDs must be an array.`);
  }
  assertStableIds(value, label);
}

function assertDuration(id: unknown, value: unknown, label: string): void {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    throw new TestEvidenceContractError(
      `Evidence '${String(id)}' ${label} has invalid durationMs.`,
    );
  }
}

function assertEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): asserts value is T[number] {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new TestEvidenceContractError(`${label} '${String(value)}' is not supported.`);
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new TestEvidenceContractError(
      `${label} contains unsupported field(s): ${sortStrings(unexpected).join(", ")}.`,
    );
  }
}

function assertStableIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    assertNonEmpty(id, label);
    if (seen.has(id)) {
      throw new TestEvidenceContractError(`${label} id '${id}' is duplicated.`);
    }
    seen.add(id);
  }
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TestEvidenceContractError(`${label} must be a non-empty string.`);
  }
}

function redactValue(value: unknown, key: string, ancestors: WeakSet<object>): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (typeof value === "string") {
    return value.replace(SECRET_LIKE_VALUE, REDACTED).replace(STRUCTURED_SECRET_VALUE, REDACTED);
  }
  if (typeof value === "object" && value !== null) {
    if (ancestors.has(value)) {
      throw new TestEvidenceContractError("Evidence must not contain cyclic values.");
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map((entry) => redactValue(entry, key, ancestors));
      }
      if (isRecord(value)) {
        return Object.fromEntries(
          Object.entries(value).map(([entryKey, entryValue]) => [
            entryKey,
            redactValue(entryValue, entryKey, ancestors),
          ]),
        );
      }
    } finally {
      ancestors.delete(value);
    }
  }
  return value;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareStrings)
      .map((key) => [key, sortJson(value[key])]),
  );
}

function isJsonValue(
  value: unknown,
  ancestors: WeakSet<object> = new WeakSet(),
): value is TestEvidenceJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") {
    if (ancestors.has(value)) return false;
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry, ancestors));
      if (isRecord(value)) {
        return Object.values(value).every((entry) => isJsonValue(entry, ancestors));
      }
    } finally {
      ancestors.delete(value);
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "&#96;")
    .replace(/\r\n|\r|\n/g, "<br>");
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}
