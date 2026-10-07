import { validateMissionDefinition } from "@croco/gamification-core";
import type { MissionPublication, MissionScope } from "@croco/gamification-core";
import { Problem, ProblemCategory } from "@croco/problems-core";

export type MissionConsoleAccess = Readonly<{
  scope: MissionScope;
  actorId: string;
  permissions: readonly string[];
}>;
export type MissionConsoleState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; message: string }>
  | Readonly<{ kind: "partial" | "ready"; publication: MissionPublication; message?: string }>;

export class MissionConsoleInvalidProblem extends Problem {
  constructor(detail: string) {
    super("gamification/console-invalid", ProblemCategory.ValidationError, detail);
  }
}

export function assertMissionPublication(
  request: MissionPublication,
  access: MissionConsoleAccess,
  registeredActions: readonly string[],
): void {
  if (
    !request ||
    !access ||
    !access.scope ||
    !request.scope ||
    typeof request.actorId !== "string" ||
    typeof access.actorId !== "string" ||
    !Array.isArray(access.permissions) ||
    request.scope.tenantId !== access.scope.tenantId ||
    request.scope.appId !== access.scope.appId ||
    request.scope.environmentId !== access.scope.environmentId ||
    typeof access.scope.tenantId !== "string" ||
    !access.scope.tenantId.trim() ||
    typeof access.scope.appId !== "string" ||
    !access.scope.appId.trim() ||
    typeof access.scope.environmentId !== "string" ||
    !access.scope.environmentId.trim() ||
    !access.permissions.includes("mission.publish") ||
    request.actorId !== access.actorId
  ) {
    throw new MissionConsoleInvalidProblem("Mission publication denied");
  }
  validateMissionDefinition(request.definition);
  if (!registeredActions.includes(request.definition.actionId))
    throw new MissionConsoleInvalidProblem("Action is not registered");
  if (
    !request.actorId.trim() ||
    typeof request.reason !== "string" ||
    !request.reason.trim() ||
    typeof request.idempotencyKey !== "string" ||
    !request.idempotencyKey.trim() ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 1 ||
    typeof request.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(request.publishedAt))
  ) {
    throw new MissionConsoleInvalidProblem(
      "Publication requires actor, reason, revision, idempotency and timestamp",
    );
  }
}
