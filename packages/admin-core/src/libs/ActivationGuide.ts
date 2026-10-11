import { validateGoalDefinition } from "@croco/onboarding-core/goal-validation";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { GoalDefinition, GoalProgress, GoalScope, GoalSubject } from "@croco/onboarding-core";

export const ACTIVATION_GUIDE_PERMISSIONS = {
  read: "onboarding.goal.read",
  preview: "onboarding.goal.preview",
  publish: "onboarding.goal.publish",
} as const;

export type ActivationGuideAccess = Readonly<{
  scope: GoalScope;
  actor: string;
  permissions: readonly string[];
}>;

export type ActivationGuidePublishRequest = Readonly<{
  scope: GoalScope;
  definition: GoalDefinition;
  actor: string;
  reason: string;
  expectedRevision: number;
  idempotencyKey: string;
}>;

export type ActivationGuidePreviewRequest = Readonly<{
  scope: GoalScope;
  subject: GoalSubject;
  episodeId: string;
  asOf: string;
}>;

export type ActivationGuidePublished = Readonly<{
  definition: GoalDefinition;
  revision: number;
  actor: string;
  reason: string;
}>;

export type ActivationGuideState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; code: string }>
  | Readonly<{
      kind: "partial" | "ready";
      published: ActivationGuidePublished;
      preview?: GoalProgress;
      message?: string;
    }>;

/** The host checks access again at the server boundary before executing each operation. */
export interface ActivationGuideOperations {
  load(access: ActivationGuideAccess): Promise<ActivationGuideState>;
  preview(
    request: ActivationGuidePreviewRequest,
    access: ActivationGuideAccess,
  ): Promise<GoalProgress>;
  publish(
    request: ActivationGuidePublishRequest,
    access: ActivationGuideAccess,
  ): Promise<ActivationGuidePublished>;
}

export class ActivationGuideValidationProblem extends Problem {
  constructor(detail: string) {
    super("onboarding/guide-invalid", ProblemCategory.ValidationError, detail);
  }
}

function assertScope(scope: GoalScope, access: ActivationGuideAccess): void {
  if (
    !scope ||
    !access.scope ||
    !scope.tenantId ||
    !scope.appId ||
    !scope.environmentId ||
    scope.tenantId !== access.scope.tenantId ||
    scope.appId !== access.scope.appId ||
    scope.environmentId !== access.scope.environmentId
  ) {
    throw new ActivationGuideValidationProblem("Goal scope denied");
  }
}

export function assertActivationGuidePermission(
  scope: GoalScope,
  access: ActivationGuideAccess,
  operation: keyof typeof ACTIVATION_GUIDE_PERMISSIONS,
): void {
  assertScope(scope, access);
  if (!access.permissions.includes(ACTIVATION_GUIDE_PERMISSIONS[operation])) {
    throw new ActivationGuideValidationProblem("Goal permission denied");
  }
}

export function assertActivationGuidePublishRequest(
  request: ActivationGuidePublishRequest,
  access: ActivationGuideAccess,
): void {
  assertActivationGuidePermission(request.scope, access, "publish");
  validateGoalDefinition(request.definition);
  if (
    typeof request.actor !== "string" ||
    !request.actor.trim() ||
    request.actor !== access.actor ||
    typeof request.reason !== "string" ||
    !request.reason.trim() ||
    typeof request.idempotencyKey !== "string" ||
    !request.idempotencyKey.trim() ||
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  ) {
    throw new ActivationGuideValidationProblem(
      "Publication requires actor, reason, revision, and idempotency",
    );
  }
}

export function assertActivationGuidePreviewRequest(
  request: ActivationGuidePreviewRequest,
  access: ActivationGuideAccess,
): void {
  assertActivationGuidePermission(request.scope, access, "preview");
  if (
    !request.subject ||
    typeof request.subject.id !== "string" ||
    !request.subject.id.trim() ||
    request.subject.verified !== true ||
    typeof request.episodeId !== "string" ||
    !request.episodeId.trim() ||
    !Number.isFinite(Date.parse(request.asOf))
  ) {
    throw new ActivationGuideValidationProblem(
      "Preview requires a verified subject, episode, and time",
    );
  }
}
