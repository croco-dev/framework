import { ResearchInvalidProblem } from "@croco/research-core";
import type {
  ResearchAccess,
  ResearchCommand,
  ResearchPage,
  ResearchScope,
  ResearchService,
} from "@croco/research-core";
export type ResearchAction =
  | Readonly<{ kind: "select" }>
  | Readonly<{ kind: "invite" | "participated"; subject: string }>
  | Readonly<{ kind: "consent"; subject: string; contact: boolean; participation: boolean }>
  | Readonly<{ kind: "response"; subject: string; response: "accepted" | "declined" | "withdrawn" }>
  | Readonly<{ kind: "note"; subject: string; text: string | null }>
  | Readonly<{ kind: "reconcile"; subject: string; outcome: "invited" | "suppressed" }>;
export type ResearchConsoleState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied" | "error"; message: string }>
  | Readonly<{ kind: "ready"; page: ResearchPage }>;
/** Server-owned access and source; forwards every write through the same authorized domain service. */
export class ResearchOperations {
  constructor(private readonly service: ResearchService) {}
  read(
    scope: ResearchScope,
    studyId: string,
    access: ResearchAccess,
    offset = 0,
    limit = 20,
  ): Promise<ResearchPage> {
    return this.service.inspect(scope, studyId, access, offset, limit);
  }
  async execute(
    scope: ResearchScope,
    studyId: string,
    action: ResearchAction,
    command: Omit<ResearchCommand, "source">,
    access: ResearchAccess,
  ): Promise<number> {
    if (!action || typeof action !== "object" || Array.isArray(action))
      throw new ResearchInvalidProblem("Research action must be an object");
    if (!command || typeof command !== "object" || Array.isArray(command))
      throw new ResearchInvalidProblem("Research command must be an object");
    const audited = {
      expectedRevision: command.expectedRevision,
      idempotencyKey: command.idempotencyKey,
      reason: command.reason,
      source: "research-console/server-command",
    };
    switch (action.kind) {
      case "select":
        return this.service.selectCandidates(scope, studyId, access, audited);
      case "invite":
        return this.service.invite(scope, studyId, action.subject, access, audited);
      case "participated":
        return this.service.markParticipated(scope, studyId, action.subject, access, audited);
      case "consent":
        return this.service.recordConsent(
          scope,
          studyId,
          action.subject,
          { contact: action.contact, participation: action.participation },
          access,
          audited,
        );
      case "response":
        return this.service.recordResponse(
          scope,
          studyId,
          action.subject,
          action.response,
          access,
          audited,
        );
      case "note":
        return this.service.writeNote(scope, studyId, action.subject, action.text, access, audited);
      case "reconcile":
        return this.service.reconcileInvitation(
          scope,
          studyId,
          action.subject,
          action.outcome,
          access,
          audited,
        );
      default:
        throw new ResearchInvalidProblem("Unsupported research operation");
    }
  }
}
