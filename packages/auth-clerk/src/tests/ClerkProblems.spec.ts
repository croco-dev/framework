import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  ClerkExternalServiceProblem,
  ClerkPublicUserDataMissingProblem,
  ClerkTokenVerificationProblem,
  ClerkTokenVerificationUpstreamProblem,
  InvalidWebhookPayloadProblem,
  WebhookVerificationProblem,
} from "../index";

describe("ClerkProblems", () => {
  describe("WebhookVerificationProblem", () => {
    it("has correct code and category", () => {
      const problem = new WebhookVerificationProblem();

      expect(problem.code).toBe("auth-clerk/webhook-verification-failed");
      expect(problem.category).toBe(ProblemCategory.Unauthorized);
    });
  });

  describe("InvalidWebhookPayloadProblem", () => {
    it("has correct code and category", () => {
      const problem = new InvalidWebhookPayloadProblem();

      expect(problem.code).toBe("auth-clerk/invalid-webhook-payload");
      expect(problem.category).toBe(ProblemCategory.ValidationError);
    });

    it("includes event type in detail when provided", () => {
      const problem = new InvalidWebhookPayloadProblem("user.created");

      expect(problem.detail).toContain("user.created");
    });
  });

  describe("ClerkTokenVerificationProblem", () => {
    it("has correct code and category", () => {
      const problem = new ClerkTokenVerificationProblem();

      expect(problem.code).toBe("auth-clerk/token-verification-failed");
      expect(problem.category).toBe(ProblemCategory.Unauthorized);
    });

    it("uses the provided detail message", () => {
      const problem = new ClerkTokenVerificationProblem("jwt expired");

      expect(problem.detail).toBe("jwt expired");
    });

    it("redacts sensitive detail values", () => {
      const problem = new ClerkTokenVerificationProblem("secret=sk_test_123 token=tok_123");

      expect(problem.detail).toBe("secret=[Redacted] token=[Redacted]");
    });
  });

  describe("ClerkTokenVerificationUpstreamProblem", () => {
    it("has correct code and category", () => {
      const problem = new ClerkTokenVerificationUpstreamProblem({
        status: 503,
        message: "Clerk temporarily unavailable",
      });

      expect(problem.code).toBe("auth-clerk/token-verification-upstream-failed");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.extensions).toMatchObject({
        operation: "verifyToken",
        provider: "clerk",
        retryable: true,
        upstreamStatus: 503,
      });
    });

    it("redacts sensitive detail values", () => {
      const problem = new ClerkTokenVerificationUpstreamProblem({
        status: 503,
        message: "token=tok_123 clerk-secret-key=sk_test_123",
      });

      expect(problem.detail).toBe(
        "Clerk verifyToken failed: token=[Redacted] clerk-secret-key=[Redacted]",
      );
    });
  });

  describe("ClerkPublicUserDataMissingProblem", () => {
    it("has correct code and category", () => {
      const problem = new ClerkPublicUserDataMissingProblem();

      expect(problem.code).toBe("auth-clerk/public-user-data-missing");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
    });
  });

  describe("ClerkExternalServiceProblem", () => {
    it("has correct code and category", () => {
      const cause = new Error("Clerk unavailable");
      const problem = new ClerkExternalServiceProblem("Failed to get user from Clerk", { cause });

      expect(problem.code).toBe("auth-clerk/external-service-error");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.cause).toBe(cause);
    });
  });
});
