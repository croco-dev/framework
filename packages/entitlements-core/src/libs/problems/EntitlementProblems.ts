import { Problem, ProblemCategory } from "@croco/problems-core";
import type { PlanVersionRef } from "@croco/billing-core";

function decisionIdOptions(
  decisionId?: string,
): { extensions: { decisionId: string } } | undefined {
  return decisionId ? { extensions: { decisionId } } : undefined;
}

export class EntitlementRequirementProblem extends Problem {
  readonly code = "ENTITLEMENT_REQUIREMENT_INVALID";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

export class EntitlementDeniedProblem extends Problem {
  readonly code = "ENTITLEMENT_DENIED";
  readonly category = ProblemCategory.Forbidden;

  constructor(feature: string, reason?: string, decisionId?: string) {
    const detail = reason
      ? `Entitlement '${feature}' denied: ${reason}`
      : `Entitlement '${feature}' denied`;
    super(undefined, undefined, detail, decisionIdOptions(decisionId));
  }
}

export class EntitlementMissingPlanProblem extends Problem {
  readonly code = "ENTITLEMENT_MISSING_PLAN";
  readonly category = ProblemCategory.Forbidden;

  constructor(feature: string, tenantId: string, decisionId?: string) {
    super(
      undefined,
      undefined,
      `Tenant '${tenantId}' has no active plan for entitlement '${feature}'`,
      decisionIdOptions(decisionId),
    );
  }
}

export class EntitlementInactiveSubscriptionProblem extends Problem {
  readonly code = "ENTITLEMENT_INACTIVE_SUBSCRIPTION";
  readonly category = ProblemCategory.Forbidden;

  constructor(feature: string, tenantId: string, decisionId?: string) {
    super(
      undefined,
      undefined,
      `Tenant '${tenantId}' has an inactive subscription for entitlement '${feature}'`,
      decisionIdOptions(decisionId),
    );
  }
}

export class EntitlementQuotaExceededProblem extends Problem {
  readonly code = "ENTITLEMENT_QUOTA_EXCEEDED";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(feature: string, usage?: number, quota?: number, decisionId?: string) {
    const detail =
      usage !== undefined && quota !== undefined
        ? `Entitlement '${feature}' quota exceeded: ${usage}/${quota}`
        : `Entitlement '${feature}' quota exceeded`;

    super(undefined, undefined, detail, decisionIdOptions(decisionId));
  }
}

export class EntitlementProviderUnavailableProblem extends Problem {
  readonly code = "ENTITLEMENT_PROVIDER_UNAVAILABLE";
  readonly category = ProblemCategory.InternalServerError;

  constructor(feature: string, cause?: Error, decisionId?: string) {
    super(undefined, undefined, `Entitlement provider unavailable while checking '${feature}'`, {
      ...(cause ? { cause } : {}),
      ...decisionIdOptions(decisionId),
    });
  }
}

export class EntitlementNotFoundProblem extends Problem {
  readonly code = "ENTITLEMENT_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor(feature: string) {
    super(undefined, undefined, `Entitlement '${feature}' not found`);
  }
}

export class EntitlementDefinitionProblem extends Problem {
  readonly code = "entitlements-core/definition-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

export class EntitlementPlanVersionNotFoundProblem extends Problem {
  readonly code = "entitlements-core/plan-version-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(ref: PlanVersionRef) {
    super(undefined, undefined, `Entitlement set for plan version '${ref}' was not found`);
  }
}

export class EntitlementPlanVersionAlreadyRegisteredProblem extends Problem {
  readonly code = "entitlements-core/plan-version-already-registered";
  readonly category = ProblemCategory.Conflict;

  constructor(ref: PlanVersionRef) {
    super(undefined, undefined, `Entitlement set for plan version '${ref}' is already registered`);
  }
}

export class EntitlementPlanVersionMismatchProblem extends Problem {
  readonly code = "entitlements-core/plan-version-mismatch";
  readonly category = ProblemCategory.Conflict;

  constructor(ref: PlanVersionRef, expectedPlanId: string, actualPlanId: string) {
    super(
      undefined,
      undefined,
      `Plan version '${ref}' belongs to '${actualPlanId}', not '${expectedPlanId}'`,
    );
  }
}
