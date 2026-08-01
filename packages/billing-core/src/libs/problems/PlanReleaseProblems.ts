import { Problem, ProblemCategory } from "@croco/problems-core";

export class StalePlanReleaseRevisionProblem extends Problem {
  readonly code = "billing/stale-plan-release-revision";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string, expected: number, actual: number) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' revision ${actual} does not match expected revision ${expected}`,
    );
  }
}

export class InvalidPlanReleaseTransitionProblem extends Problem {
  readonly code = "billing/invalid-plan-release-transition";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(ref: string, from: string, to: string) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' cannot transition from '${from}' to '${to}'`,
    );
  }
}

export class OverlappingPlanEffectivePeriodProblem extends Problem {
  readonly code = "billing/overlapping-plan-effective-period";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string, conflictingRef: string) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' overlaps effective period of '${conflictingRef}'`,
    );
  }
}

export class PlanReleaseValidationFailedProblem extends Problem {
  readonly code = "billing/plan-release-validation-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(ref: string, diagnosticCodes: readonly string[]) {
    super(undefined, undefined, `Plan release '${ref}' failed structural validation`, {
      extensions: { diagnosticCodes },
    });
  }
}

export class PlanReleaseProviderCapabilityProblem extends Problem {
  readonly code = "billing/plan-release-provider-capability-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(ref: string, factCodes: readonly string[]) {
    super(undefined, undefined, `Plan release '${ref}' failed provider capability preflight`, {
      extensions: { factCodes },
    });
  }
}

export class InvalidPlanReleaseScheduleProblem extends Problem {
  readonly code = "billing/invalid-plan-release-schedule";
  readonly category = ProblemCategory.BadRequest;
  constructor(ref: string, reason: string) {
    super(undefined, undefined, `Plan release '${ref}' schedule is invalid: ${reason}`);
  }
}

export class PlanReleasePublishConflictProblem extends Problem {
  readonly code = "billing/plan-release-publish-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string, idempotencyKey: string) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' publish key '${idempotencyKey}' conflicts with recorded publication`,
    );
  }
}
