import { Problem, ProblemCategory } from "@croco/problems-core";

export type ResearchScope = Readonly<{ app: string; environment: string; tenantId: string }>;
export type ResearchPermission =
  | "research.read"
  | "research.write"
  | "research.participate"
  | "research.notes";
/** Supplied by the authenticated server session, never deserialized from a browser request. */
export type ResearchAccess = Readonly<{ scope: ResearchScope; actor: string; principal: unknown }>;
export interface ResearchAuthorizer {
  authorize(
    access: ResearchAccess,
    permission: ResearchPermission,
    subject?: string,
  ): Promise<boolean>;
}
export type StudyDefinition = Readonly<{
  id: string;
  version: number;
  groups: readonly Readonly<{ id: string; quota: number; outcome: "achieved" | "not-achieved" }>[];
  quotaUnit: "active-invitations";
  slotPolicy: "release-declined-withdrawn";
  seed: string;
  datasetDefinition: string;
  sourceSnapshotId: string;
  observationEndsAt: string;
  bookingUrl: string;
  contactPolicy: Readonly<{
    perStudyCap: number;
    excludeParticipatedSince: string;
    excludeContactedSince: string;
  }>;
  noteRetentionDays: number;
}>;
export type Candidate = Readonly<{
  subject: string;
  group: string;
  sourceSnapshotId: string;
  observedThrough: string;
  eligible: boolean;
  contactConsent: boolean;
  consentSource: string;
  consentRecordedAt: string;
  priorContactAt?: string;
  priorParticipatedAt?: string;
}>;
export type InvitationState =
  | "selected"
  | "admitted"
  | "invited"
  | "accepted"
  | "declined"
  | "participated"
  | "withdrawn"
  | "suppressed"
  | "unknown";
export type Invitation = {
  id: string;
  subject: string;
  group: string;
  state: InvitationState;
  contactCount: number;
  executionIds: string[];
  participationConsent: boolean;
  lastContactAt?: string;
  failureCode?: string;
};
export type ResearchAudit = Readonly<{
  actor: string;
  reason: string;
  revision: number;
  idempotencyKey: string;
  at: string;
  operation: string;
  subject?: string;
  source: string;
  transitions?: readonly Readonly<{ subject: string; state: InvitationState }>[];
  contactConsent?: boolean;
  participationConsent?: boolean;
}>;
export type ResearchCommand = Readonly<{
  expectedRevision: number;
  idempotencyKey: string;
  reason: string;
  source: string;
}>;
export type ResearchNote = { subject: string; text: string; expiresAt: string };
/** Bounded aggregate: at most 10,000 candidates and 50,000 audited mutations per study. */
export type ResearchRecord = {
  definition?: StudyDefinition;
  revision: number;
  candidates: Candidate[];
  consents: {
    subject: string;
    contact: boolean;
    participation: boolean;
    recordedAt: string;
    source: string;
  }[];
  candidateFingerprints: { subject: string; fingerprint: string }[];
  invitations: Invitation[];
  notes: ResearchNote[];
  history: ResearchAudit[];
  mutations: { key: string; fingerprint: string }[];
};
export interface ResearchStore {
  read(scope: ResearchScope, studyId: string): Promise<ResearchRecord>;
  /** Serialize and commit atomically per app/environment/tenant/study; rollback on rejection. No external dispatch inside. */
  transact<T>(
    scope: ResearchScope,
    studyId: string,
    operation: (record: ResearchRecord) => Promise<T>,
  ): Promise<T>;
}
export type ResearchDispatchResult =
  | Readonly<{ status: "queued"; executionIds: readonly string[] }>
  | Readonly<{ status: "suppressed"; reason: string }>;
export interface ResearchSender {
  send(
    scope: ResearchScope,
    study: StudyDefinition,
    invitation: Invitation,
  ): Promise<ResearchDispatchResult>;
}
export type ResearchGroupProgress = Readonly<{
  group: string;
  population: number;
  eligible: number;
  selected: number;
  invited: number;
  accepted: number;
  participated: number;
  unknown: number;
  held: number;
  shortage: number;
}>;
export type ResearchPage = Readonly<{
  scope: ResearchScope;
  study: StudyDefinition;
  revision: number;
  groups: readonly ResearchGroupProgress[];
  candidates: readonly Readonly<{
    candidate: Candidate;
    invitation?: Invitation;
    exclusion?: string;
    note?: string;
  }>[];
  history: readonly ResearchAudit[];
  nextOffset?: number;
}>;
export class ResearchInvalidProblem extends Problem {
  constructor(detail: string) {
    super("research/invalid", ProblemCategory.BadRequest, detail);
  }
}
export class ResearchConflictProblem extends Problem {
  constructor(detail: string) {
    super("research/conflict", ProblemCategory.Conflict, detail);
  }
}
export class ResearchDeniedProblem extends Problem {
  constructor() {
    super("research/denied", ProblemCategory.Forbidden, "Research operation is not authorized");
  }
}
export class ResearchPersistenceProblem extends Problem {
  constructor() {
    super(
      "research/persistence",
      ProblemCategory.InternalServerError,
      "Research persistence failed",
    );
  }
}
export function researchIdentity(scope: ResearchScope, studyId: string): string {
  for (const value of [scope?.app, scope?.environment, scope?.tenantId, studyId]) {
    if (typeof value !== "string" || !value.trim() || value.length > 200)
      throw new ResearchInvalidProblem(
        "Explicit bounded app, environment, tenant and study are required",
      );
  }
  return JSON.stringify([scope.app, scope.environment, scope.tenantId, studyId]);
}
export function emptyResearchRecord(): ResearchRecord {
  return {
    revision: 0,
    candidates: [],
    consents: [],
    candidateFingerprints: [],
    invitations: [],
    notes: [],
    history: [],
    mutations: [],
  };
}
