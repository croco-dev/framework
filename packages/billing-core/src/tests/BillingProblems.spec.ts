import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  SubscriptionNotFoundProblem,
} from "../libs/problems/BillingProblems";
import {
  InvalidPlanReleaseTransitionProblem,
  OverlappingPlanEffectivePeriodProblem,
  PlanReleaseProviderCapabilityProblem,
  PlanReleaseValidationFailedProblem,
  StalePlanReleaseRevisionProblem,
} from "../libs/problems/PlanReleaseProblems";

describe("BillingProblems", () => {
  describe("SubscriptionNotFoundProblem", () => {
    it("has correct code and category", () => {
      const problem = new SubscriptionNotFoundProblem("tenant-1");

      expect(problem.code).toBe("billing/subscription-not-found");
      expect(problem.category).toBe(ProblemCategory.NotFound);
    });
  });

  describe("BillingAccountNotFoundProblem", () => {
    it("has correct code and category", () => {
      const problem = new BillingAccountNotFoundProblem("tenant-1");

      expect(problem.code).toBe("billing/account-not-found");
      expect(problem.category).toBe(ProblemCategory.NotFound);
    });
  });

  describe("BillingCheckoutCreationProblem", () => {
    it("has correct code and category", () => {
      const problem = new BillingCheckoutCreationProblem("tenant-1");

      expect(problem.code).toBe("billing/checkout-creation-failed");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
    });
  });

  it("keeps plan release failures in stable recovery categories", () => {
    expect(new StalePlanReleaseRevisionProblem("pro@1", 1, 2)).toMatchObject({
      code: "billing/stale-plan-release-revision",
      category: ProblemCategory.Conflict,
    });
    expect(new InvalidPlanReleaseTransitionProblem("pro@1", "draft", "published")).toMatchObject({
      code: "billing/invalid-plan-release-transition",
      category: ProblemCategory.BusinessRuleViolation,
    });
    expect(new OverlappingPlanEffectivePeriodProblem("pro@2", "pro@1")).toMatchObject({
      code: "billing/overlapping-plan-effective-period",
      category: ProblemCategory.Conflict,
    });
    expect(new PlanReleaseValidationFailedProblem("pro@1", ["invalid"])).toMatchObject({
      code: "billing/plan-release-validation-failed",
      category: ProblemCategory.ValidationError,
    });
    expect(new PlanReleaseProviderCapabilityProblem("pro@1", ["usage"])).toMatchObject({
      code: "billing/plan-release-provider-capability-failed",
      category: ProblemCategory.ValidationError,
    });
  });
});
