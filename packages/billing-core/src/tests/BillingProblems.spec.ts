import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  BillingAccountNotFoundProblem,
  BillingAccountTenantConflictProblem,
  BillingCheckoutCreationProblem,
  SubscriptionNotFoundProblem,
} from "../libs/problems/BillingProblems";

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

  describe("BillingAccountTenantConflictProblem", () => {
    it("identifies both account owners in a tenant conflict", () => {
      const problem = new BillingAccountTenantConflictProblem("tenant-1", "account-1", "account-2");

      expect(problem.code).toBe("billing/account-tenant-conflict");
      expect(problem.category).toBe(ProblemCategory.Conflict);
      expect(problem.extensions).toEqual({
        tenantId: "tenant-1",
        existingAccountId: "account-1",
        requestedAccountId: "account-2",
      });
    });
  });

  describe("BillingCheckoutCreationProblem", () => {
    it("has correct code and category", () => {
      const problem = new BillingCheckoutCreationProblem("tenant-1");

      expect(problem.code).toBe("billing/checkout-creation-failed");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
    });
  });
});
