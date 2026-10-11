import { Problem, ProblemCategory } from "@croco/problems-core";

export type ChallengeOperationsDefinition = Readonly<{
  id: string;
  version: number;
  scope: Readonly<{ app: string; environment: string; tenantId: string }>;
  start: Date;
  end: Date;
  goal: number;
  memberCap: number | null;
  minMembers: number;
  lateAllowanceMs: number;
  visibility: "aggregate" | "consented";
  leavePolicy: "retain" | "remove";
}>;
export type ChallengeOperationsView = Readonly<{
  pendingEvidenceCount: number;
  challenge: ChallengeOperationsDefinition &
    Readonly<{
      state: "scheduled" | "active" | "closing" | "completed" | "expired";
      progress: number;
      memberCount: number;
    }>;
}>;
export type ChallengeOperationsState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; message: string }
  | { kind: "ready" | "partial"; view: ChallengeOperationsView; message?: string };
export type ChallengeOperationsAudit = Readonly<{
  actor: string;
  reason: string;
  idempotencyKey: string;
}>;
export type ChallengeOperationsSave = ChallengeOperationsAudit &
  Readonly<{ definition: ChallengeOperationsDefinition }> &
  ({ kind: "create" } | { kind: "update"; expectedVersion: number });
export type ChallengeOperationsClose = ChallengeOperationsAudit &
  Readonly<{ expectedVersion: number }>;
/** The adapter binds scope and server-authorized identity and invokes the same challenge service as participation. */
export interface ChallengeOperationsSource {
  load(): Promise<ChallengeOperationsState>;
  save(request: ChallengeOperationsSave): Promise<ChallengeOperationsState>;
  close(request: ChallengeOperationsClose): Promise<ChallengeOperationsState>;
}
export class ChallengeOperationsProblem extends Problem {
  constructor(detail: string) {
    super("admin-core/challenge-operation-invalid", ProblemCategory.ValidationError, detail);
  }
}
export function assertChallengeOperationsAudit(
  request: ChallengeOperationsAudit & { expectedVersion?: number },
): void {
  if (
    ![request.actor, request.reason, request.idempotencyKey].every(
      (value) => typeof value === "string" && value.trim(),
    ) ||
    (request.expectedVersion !== undefined &&
      (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1))
  ) {
    throw new ChallengeOperationsProblem(
      "Actor, reason, idempotency key and a valid expected revision are required.",
    );
  }
}
export async function loadChallengeOperations(
  source: ChallengeOperationsSource,
  permissions: readonly string[],
): Promise<ChallengeOperationsState> {
  if (!permissions.includes("challenge.read"))
    return { kind: "denied", message: "Challenge read permission is required." };
  return source.load();
}
