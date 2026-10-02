import { createHash } from "node:crypto";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { normalizePolicyScope, stableStringify } from "./Policy";
import type { PolicyScope } from "./Policy";

export type ExperimentScope = PolicyScope;
export type ExperimentUnit = "user" | "tenant" | "anonymous";
export type ExperimentSubject = { readonly kind: ExperimentUnit; readonly id: string };
export type ExperimentState = "draft" | "running" | "paused" | "stopped";
export type ExperimentVariant = {
  readonly id: string;
  readonly value: string | boolean | number;
  readonly weight: number;
};
export type ExperimentDefinition = {
  readonly id: string;
  readonly revision: string;
  readonly unit: ExperimentUnit;
  /** Preserve anonymous identity through login, or explicitly switch identity without merging history. */
  readonly loginPolicy: "preserve-unit" | "switch-unit";
  readonly salt: string;
  readonly allocatorVersion: "sha256-v1";
  /** Basis points, inclusive zero and exclusive allocation; weights must sum to allocation. */
  readonly allocation: number;
  readonly variants: readonly ExperimentVariant[];
  readonly hypothesis: string;
  readonly observationPlan: string;
  readonly eligibility: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
};
export type ExperimentTarget = {
  readonly experimentId: string;
  readonly experimentRevision: string;
  readonly scope: ExperimentScope;
};
export type ExperimentRecord = ExperimentTarget & {
  /** Original code registration whose handlers and provider serve this revision. */
  readonly codeRevision: string;
  readonly definition: ExperimentDefinition;
  readonly definitionHash: string;
  readonly state: ExperimentState;
  readonly version: number;
};
/** Structural projection of the existing cohort publication contract; no source traits are retained. */
export type ExperimentSnapshotReference = {
  readonly snapshotId: string;
  readonly scope: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId: string;
  };
  readonly subjectKind: string;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly schemaVersion: 1;
  readonly sourceSnapshotRefs: readonly string[];
  readonly asOf: string;
  readonly generatedAt: string;
  readonly validUntil: string;
  readonly contentHash: string;
  readonly publicationRevision: number;
  readonly privacyVersion: string;
  readonly membershipRef: string;
};
export type ExperimentEligibility =
  | { readonly status: "eligible"; readonly snapshotRef?: ExperimentSnapshotReference }
  | { readonly status: "ineligible" | "unavailable"; readonly reason: string };
export type DetailedEvaluation<T = string | boolean | number> =
  | {
      readonly status: "evaluated";
      readonly appRevision: string;
      readonly value: T;
      readonly reason: string;
      readonly providerMetadata?: Readonly<Record<string, string>>;
    }
  | {
      readonly status: "unavailable" | "evaluation_failed" | "not_assigned";
      readonly reason: string;
      readonly providerMetadata?: Readonly<Record<string, string>>;
    };
export interface ExperimentEvaluationProvider {
  /** Evaluate without assignment, exposure, analytics events, or other persistent side effects. */
  previewDetailed?(
    input: ExperimentTarget & {
      readonly subject: ExperimentSubject;
      readonly definition: ExperimentDefinition;
    },
  ): Promise<DetailedEvaluation>;
  evaluateDetailed(
    input: ExperimentTarget & {
      readonly subject: ExperimentSubject;
      readonly definition: ExperimentDefinition;
    },
  ): Promise<DetailedEvaluation>;
}
export type ExperimentAssignment = ExperimentTarget & {
  readonly id: string;
  readonly subject: ExperimentSubject;
  readonly variant: string;
  readonly value: string | boolean | number;
  readonly assignedAt: string;
  readonly providerRef?: Readonly<Record<string, string>>;
  readonly eligibilitySnapshotRef?: ExperimentSnapshotReference;
};
export type ExperimentExposure = {
  readonly id: string;
  readonly assignmentId: string;
  readonly deliveryInstanceId: string;
  readonly occurredAt: string;
  readonly kind: "display" | "treatment";
};
export type ExperimentCommand = ExperimentTarget & {
  readonly action: "start" | "pause" | "stop";
  readonly expectedRevision: number;
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};
export type ExperimentCommandReceipt = {
  readonly command: ExperimentCommand;
  readonly fingerprint: string;
  readonly record: ExperimentRecord;
  readonly occurredAt: string;
};
export type ExperimentConfigureCommand = ExperimentTarget & {
  readonly action: "configure";
  readonly definition: ExperimentDefinition;
  readonly expectedRevision: number;
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};
export type ExperimentConfigureReceipt = {
  readonly command: ExperimentConfigureCommand;
  readonly fingerprint: string;
  readonly record: ExperimentRecord;
  readonly occurredAt: string;
};
export type ExperimentAdmission =
  | { readonly status: "admitted"; readonly assignment: ExperimentAssignment }
  | { readonly status: "not_assigned"; readonly reason: string };
/** All mutations must serialize against commands for the same target. Receipt and audit commit with state. */
export interface ExperimentStore {
  configure(
    command: ExperimentConfigureCommand,
    record: ExperimentRecord,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentConfigureReceipt>;
  register(record: ExperimentRecord): Promise<ExperimentRecord>;
  get(target: ExperimentTarget): Promise<ExperimentRecord | null>;
  list(scope: ExperimentScope): Promise<readonly ExperimentRecord[]>;
  command(
    command: ExperimentCommand,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentCommandReceipt>;
  /** Returns the unique stored winner; validates running state and time window atomically. */
  assign(candidate: ExperimentAssignment, now: string): Promise<ExperimentAdmission>;
  getAssignment(id: string): Promise<ExperimentAssignment | null>;
  /** Rechecks current running state at the treatment admission boundary. */
  admit(
    id: string,
    scope: ExperimentScope,
    subject: ExperimentSubject,
    now: string,
  ): Promise<ExperimentAdmission>;
  /** Validates original assignment ownership; dedupes assignmentId+deliveryInstanceId. */
  recordExposure(
    exposure: ExperimentExposure,
    scope: ExperimentScope,
    subject: ExperimentSubject,
  ): Promise<ExperimentExposure>;
}
export type ExperimentAuthorizationRequest = {
  readonly action:
    | "configure"
    | "register"
    | "read"
    | "preview"
    | "assign"
    | "treat"
    | "exposure"
    | "start"
    | "pause"
    | "stop";
  readonly scope: ExperimentScope;
  readonly actor: string;
  readonly experimentId: string;
  readonly subject?: ExperimentSubject;
};
export interface ExperimentAuthorization {
  authorize(request: ExperimentAuthorizationRequest): boolean | Promise<boolean>;
}
export type ExperimentInput = ExperimentTarget & {
  readonly actor: string;
  readonly subject: ExperimentSubject;
  readonly context?: Readonly<Record<string, unknown>>;
};
export type ExperimentRegistration = {
  readonly definition: ExperimentDefinition;
  readonly handlers: Readonly<
    Record<string, (context: Readonly<Record<string, unknown>>) => unknown | Promise<unknown>>
  >;
  /** Inject an adapter using the published audience reader here; never fetch source systems during serving. */
  readonly eligibility: (
    input: ExperimentInput,
    now: string,
  ) => ExperimentEligibility | Promise<ExperimentEligibility>;
  readonly provider?: ExperimentEvaluationProvider;
};
const EXPERIMENT_PROBLEMS = {
  invalid: { code: "features/experiment/invalid", category: ProblemCategory.ValidationError },
  conflict: { code: "features/experiment/conflict", category: ProblemCategory.Conflict },
  forbidden: { code: "features/experiment/forbidden", category: ProblemCategory.Forbidden },
  missing: { code: "features/experiment/missing", category: ProblemCategory.NotFound },
  "idempotency-conflict": {
    code: "features/experiment/idempotency-conflict",
    category: ProblemCategory.Conflict,
  },
  unavailable: {
    code: "features/experiment/unavailable",
    category: ProblemCategory.InternalServerError,
  },
} as const;

export class ExperimentProblem extends Problem {
  constructor(
    code: "invalid" | "conflict" | "forbidden" | "missing" | "idempotency-conflict" | "unavailable",
    detail: string,
    options?: { readonly cause?: Error },
  ) {
    const metadata = EXPERIMENT_PROBLEMS[code];
    super(metadata.code, metadata.category, detail, options);
  }
}
export function experimentKey(target: ExperimentTarget): string {
  return stableStringify([
    target.experimentId,
    target.experimentRevision,
    normalizePolicyScope(target.scope),
  ]);
}
export function experimentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
export function experimentAssignmentKey(
  target: ExperimentTarget,
  subject: ExperimentSubject,
): string {
  return experimentHash([experimentKey(target), subject.kind, subject.id]);
}
export function experimentBucket(
  definition: ExperimentDefinition,
  scope: ExperimentScope,
  subject: ExperimentSubject,
): number {
  const encoded = stableStringify([
    "sha256-v1",
    definition.salt,
    definition.id,
    definition.revision,
    normalizePolicyScope(scope),
    subject.kind,
    subject.id,
  ]);
  return (
    Number.parseInt(createHash("sha256").update(encoded).digest("hex").slice(0, 13), 16) % 10000
  );
}
export function experimentActive(record: ExperimentRecord, now: string): boolean {
  const time = Date.parse(now);
  return (
    record.state === "running" &&
    Number.isFinite(time) &&
    (!record.definition.startsAt || time >= Date.parse(record.definition.startsAt)) &&
    (!record.definition.endsAt || time < Date.parse(record.definition.endsAt))
  );
}
export function assertExperimentOwnership(
  assignment: ExperimentAssignment,
  scope: ExperimentScope,
  subject: ExperimentSubject,
): void {
  if (
    stableStringify(assignment.scope) !== stableStringify(normalizePolicyScope(scope)) ||
    assignment.subject.kind !== subject.kind ||
    assignment.subject.id !== subject.id
  )
    throw new ExperimentProblem("forbidden", "Assignment ownership mismatch");
}

/** The host supplies verified identities. Switching never merges old anonymous assignments. */
export function resolveExperimentSubject(
  definition: Pick<ExperimentDefinition, "unit" | "loginPolicy">,
  identity: { readonly anonymousId?: string; readonly userId?: string; readonly tenantId?: string },
): ExperimentSubject | null {
  const kind =
    definition.unit === "anonymous" && definition.loginPolicy === "switch-unit" && identity.userId
      ? "user"
      : definition.unit;
  const id =
    kind === "anonymous"
      ? identity.anonymousId
      : kind === "user"
        ? identity.userId
        : identity.tenantId;
  return typeof id === "string" && id.trim() ? { kind, id } : null;
}
