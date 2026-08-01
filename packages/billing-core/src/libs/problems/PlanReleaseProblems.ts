import { Problem, ProblemCategory } from "@croco/problems-core";

import type { PlanReleaseState } from "../PlanRelease";

/** Reports that a release write lost its optimistic-concurrency race. */
export class StalePlanReleaseRevisionProblem extends Problem {
  readonly code = "billing/stale-plan-release-revision";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string, expected: number, actual: number) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' revision ${actual} does not match expected revision ${expected}`,
      { extensions: { expectedRevision: expected, actualRevision: actual } },
    );
  }
}

/** Reports a lifecycle edge that is not allowed from the release's current state. */
export class InvalidPlanReleaseTransitionProblem extends Problem {
  readonly code = "billing/invalid-plan-release-transition";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(ref: string, from: PlanReleaseState | null, to: PlanReleaseState) {
    super(
      undefined,
      undefined,
      `Plan release '${ref}' cannot transition from '${from}' to '${to}'`,
    );
  }
}

/** Reports that two versions in one plan family claim overlapping effective periods. */
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

/** Carries deterministic structural-validation diagnostic codes for a rejected review. */
export class PlanReleaseValidationFailedProblem extends Problem {
  readonly code = "billing/plan-release-validation-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(ref: string, diagnosticCodes: readonly string[]) {
    super(undefined, undefined, `Plan release '${ref}' failed structural validation`, {
      extensions: { diagnosticCodes },
    });
  }
}

/** Carries provider-preflight fact codes that prevent publication. */
export class PlanReleaseProviderCapabilityProblem extends Problem {
  readonly code = "billing/plan-release-provider-capability-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(ref: string, factCodes: readonly string[]) {
    super(undefined, undefined, `Plan release '${ref}' failed provider capability preflight`, {
      extensions: { factCodes },
    });
  }
}

/** Reports a schedule whose effective instant cannot be used for the requested transition. */
export class InvalidPlanReleaseScheduleProblem extends Problem {
  readonly code = "billing/invalid-plan-release-schedule";
  readonly category = ProblemCategory.BadRequest;
  constructor(ref: string, reason: string) {
    super(undefined, undefined, `Plan release '${ref}' schedule is invalid: ${reason}`);
  }
}

/** Reports reuse of a publish key for a different command or recorded publication. */
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
