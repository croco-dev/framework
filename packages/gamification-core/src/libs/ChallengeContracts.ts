import { Problem, ProblemCategory } from "@croco/problems-core";

export type ChallengeScope = Readonly<{ app: string; environment: string; tenantId: string }>;
export type ChallengeDefinition = Readonly<{
  id: string;
  version: number;
  scope: ChallengeScope;
  start: Date;
  end: Date;
  goal: number;
  memberCap: number | null;
  minMembers: number;
  lateAllowanceMs: number;
  visibility: "aggregate" | "consented";
  leavePolicy: "retain" | "remove";
}>;
export type ChallengeState = "scheduled" | "active" | "closing" | "completed" | "expired";
export type Challenge = ChallengeDefinition &
  Readonly<{
    state: ChallengeState;
    progress: number;
    memberCount: number;
    erasedProgress: number;
    finalizedAt: Date | null;
  }>;
export type ChallengeMember = Readonly<{
  subjectId: string;
  intervals: readonly Readonly<{ joinedAt: Date; leftAt: Date | null }>[];
  publicConsent: boolean;
  consentVersion: number;
}>;
export type ChallengeContribution = Readonly<{
  eventId: string;
  sourceId: string;
  subjectId: string;
  occurredAt: Date;
  amount: number;
  revision: number;
  acceptedAt: Date;
  correctionOf: string | null;
}>;
export type ChallengeEvidenceAttempt = Readonly<{
  id: string;
  eventId: string;
  sourceId: string;
  subjectId: string;
  receivedAt: Date;
  state: "unknown" | "accepted" | "rejected";
  idempotencyKey: string;
  fingerprint: string;
}>;
export type ChallengeReceipt = Readonly<{
  action: ChallengeAction;
  definitionVersion: number;
  idempotencyKey: string;
  fingerprint: string;
  subjectHash: string | null;
  actor: string;
  reason: string;
  recordedAt: Date;
}>;
export type ChallengeCompletion = Readonly<{
  id: string;
  challengeId: string;
  definitionVersion: number;
  progress: number;
  memberCount: number;
  completedAt: Date;
}>;
export interface ChallengeTransaction {
  readonly challenge: Challenge | null;
  readonly members: readonly ChallengeMember[];
  readonly contributions: readonly ChallengeContribution[];
  readonly evidenceAttempts: readonly ChallengeEvidenceAttempt[];
  saveEvidenceAttempt(value: ChallengeEvidenceAttempt): void;
  readonly receipts: readonly ChallengeReceipt[];
  readonly completion: ChallengeCompletion | null;
  readonly erasedEventIds: readonly string[];
  readonly erasedSubjectHashes: readonly string[];
  saveChallenge(value: Challenge): void;
  saveMember(value: ChallengeMember): void;
  saveContribution(value: ChallengeContribution): void;
  saveReceipt(value: ChallengeReceipt): void;
  saveCompletion(value: ChallengeCompletion): void;
  /** Delete identifying membership, evidence and audit data; retain opaque replay tombstones. */
  eraseSubject(subjectId: string, subjectHash: string): void;
}
/** Durably serializes one full scoped challenge, including concurrent creation. Rolls back on failure. */
export interface ChallengeStore {
  transact<T>(
    scope: ChallengeScope,
    challengeId: string,
    operation: (transaction: ChallengeTransaction) => Promise<T>,
  ): Promise<T>;
}
export type ChallengeAccess = Readonly<{
  scope: ChallengeScope;
  challengeId: string;
  subjectId: string;
  actor: Readonly<{ id: string; reason: string }>;
}>;
export type ChallengeCommand = ChallengeAccess & Readonly<{ idempotencyKey: string }>;
export type ChallengeView = Readonly<{
  challenge: Challenge;
  self: ChallengeMember | null;
  selfProgress: number;
  pendingEvidenceCount: number;
  participants: readonly Readonly<{ subjectId: string; progress: number }>[];
}>;
export type ChallengeAction =
  | "create"
  | "updateDefinition"
  | "join"
  | "leave"
  | "contribute"
  | "close"
  | "read"
  | "eraseSubject";
export class ChallengeInvalidProblem extends Problem {
  constructor(detail: string) {
    super("gamification-core/challenge-invalid", ProblemCategory.ValidationError, detail);
  }
}
export class ChallengeConflictProblem extends Problem {
  constructor(detail: string) {
    super("gamification-core/challenge-conflict", ProblemCategory.Conflict, detail);
  }
}
export class ChallengeAccessDeniedProblem extends Problem {
  constructor() {
    super(
      "gamification-core/challenge-access-denied",
      ProblemCategory.Forbidden,
      "Verified membership and server permission are required",
    );
  }
}
export class ChallengeNotFoundProblem extends Problem {
  constructor() {
    super(
      "gamification-core/challenge-not-found",
      ProblemCategory.NotFound,
      "Challenge does not exist",
    );
  }
}
export class ChallengeEvidenceProblem extends Problem {
  constructor(detail: string) {
    super("gamification-core/challenge-evidence", ProblemCategory.ValidationError, detail);
  }
}
export class ChallengeEvidenceUnavailableProblem extends Problem {
  constructor(cause: unknown) {
    super(
      "gamification-core/challenge-evidence-unavailable",
      ProblemCategory.InternalServerError,
      "The evidence source could not verify this event",
      cause instanceof Error ? { cause } : undefined,
    );
  }
}
export function assertChallengeScope(scope: ChallengeScope, challengeId: string): void {
  if (!scope || ![scope.app, scope.environment, scope.tenantId, challengeId].every(nonempty))
    throw new ChallengeInvalidProblem("Full scope and challenge id are required");
}
export function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function assertChallengeDefinition(value: ChallengeDefinition): void {
  if (!value || typeof value !== "object")
    throw new ChallengeInvalidProblem("Challenge definition is required");
  assertChallengeScope(value.scope, value.id);
  if (
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    !validDate(value.start) ||
    !validDate(value.end) ||
    value.end <= value.start ||
    !Number.isSafeInteger(value.goal) ||
    value.goal <= 0 ||
    !Number.isSafeInteger(value.minMembers) ||
    value.minMembers < 1 ||
    (value.memberCap !== null && (!Number.isSafeInteger(value.memberCap) || value.memberCap < 1)) ||
    !Number.isSafeInteger(value.lateAllowanceMs) ||
    value.lateAllowanceMs < 0 ||
    !validDate(new Date(value.end.getTime() + value.lateAllowanceMs)) ||
    !["aggregate", "consented"].includes(value.visibility) ||
    !["retain", "remove"].includes(value.leavePolicy)
  )
    throw new ChallengeInvalidProblem("Invalid challenge definition");
}
export function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
