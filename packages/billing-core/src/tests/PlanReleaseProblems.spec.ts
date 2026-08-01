import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";

import {
  InvalidPlanReleaseScheduleProblem,
  InvalidPlanReleaseTransitionProblem,
  OverlappingPlanEffectivePeriodProblem,
  PlanReleaseProviderCapabilityProblem,
  PlanReleasePublishConflictProblem,
  PlanReleaseValidationFailedProblem,
  StalePlanReleaseRevisionProblem,
} from "../libs/problems/PlanReleaseProblems";

describe("PlanReleaseProblems", () => {
  it.each([
    [
      new StalePlanReleaseRevisionProblem("pro@1", 1, 2),
      "billing/stale-plan-release-revision",
      ProblemCategory.Conflict,
    ],
    [
      new InvalidPlanReleaseTransitionProblem("pro@1", "draft", "published"),
      "billing/invalid-plan-release-transition",
      ProblemCategory.BusinessRuleViolation,
    ],
    [
      new OverlappingPlanEffectivePeriodProblem("pro@2", "pro@1"),
      "billing/overlapping-plan-effective-period",
      ProblemCategory.Conflict,
    ],
    [
      new PlanReleaseValidationFailedProblem("pro@1", ["invalid"]),
      "billing/plan-release-validation-failed",
      ProblemCategory.ValidationError,
    ],
    [
      new PlanReleaseProviderCapabilityProblem("pro@1", ["usage"]),
      "billing/plan-release-provider-capability-failed",
      ProblemCategory.ValidationError,
    ],
    [
      new InvalidPlanReleaseScheduleProblem("pro@1", "past"),
      "billing/invalid-plan-release-schedule",
      ProblemCategory.BadRequest,
    ],
    [
      new PlanReleasePublishConflictProblem("pro@1", "publish-1"),
      "billing/plan-release-publish-conflict",
      ProblemCategory.Conflict,
    ],
  ] as const)("exposes %s as a stable recovery category", (problem, code, category) => {
    expect(problem).toMatchObject({ code, category });
  });

  it("includes expected and actual revisions in stale-write evidence", () => {
    expect(new StalePlanReleaseRevisionProblem("pro@1", 1, 2).extensions).toEqual({
      expectedRevision: 1,
      actualRevision: 2,
    });
  });
});
