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
import {
  createClerkOperationProblem,
  isClerkResourceNotFoundError,
} from "../libs/problems/ClerkProblems";

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

    it.each([
      {
        error: { status: 503, message: "Unavailable secret=sk_test_leaked" },
        expectedRetryable: true,
        expectedStatus: 503,
        operation: "users.getUser",
        scenario: "read outage",
      },
      {
        error: { response: { statusCode: "429" }, message: "Rate limited" },
        expectedRetryable: true,
        expectedStatus: 429,
        operation: "users.getUserList",
        scenario: "list throttling",
      },
      {
        error: { statusCode: 403, message: "Forbidden token=clerk_request_token" },
        expectedRetryable: false,
        expectedStatus: 403,
        operation: "organizations.createOrganization",
        scenario: "mutation permission failure",
      },
    ])(
      "classifies $scenario without serializing SDK details",
      ({ error, expectedRetryable, expectedStatus, operation }) => {
        const problem = createClerkOperationProblem(error, operation);

        expect(problem).toMatchObject({
          code: "auth-clerk/external-service-error",
          detail: `Clerk operation '${operation}' failed`,
          extensions: {
            operation,
            provider: "clerk",
            retryable: expectedRetryable,
            upstreamStatus: expectedStatus,
          },
        });
        expect(JSON.stringify(problem)).not.toContain("sk_test_leaked");
        expect(JSON.stringify(problem)).not.toContain("clerk_request_token");
      },
    );

    it.each([
      { allowMessageFallback: false, error: { status: 404 }, scenario: "numeric status" },
      { allowMessageFallback: false, error: { statusCode: "404" }, scenario: "string status" },
      {
        allowMessageFallback: true,
        error: new Error("Organization not found"),
        scenario: "organization lookup message",
      },
    ])("preserves expected not-found behavior for $scenario", ({ allowMessageFallback, error }) => {
      expect(isClerkResourceNotFoundError(error, allowMessageFallback)).toBe(true);
    });

    it("does not collapse an unclassified lookup message into absence", () => {
      expect(isClerkResourceNotFoundError(new Error("Endpoint not found"))).toBe(false);
    });
  });
});
