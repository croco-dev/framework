import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  BetterAuthNotInitializedProblem,
  BetterAuthSessionNotFoundProblem,
  BetterAuthUserNotFoundProblem,
} from "../libs/problems/AuthProblems";
import { BetterAuthInvalidSessionProblem } from "../libs/problems/BetterAuthInvalidSessionProblem";
import { BetterAuthSessionLookupProblem } from "../libs/problems/BetterAuthSessionLookupProblem";
import {
  InvalidWebhookPayloadProblem,
  InvalidWebhookSignatureProblem,
} from "../libs/problems/WebhookProblems";

describe("BetterAuthInvalidSessionProblem", () => {
  it("should have correct code", () => {
    const problem = new BetterAuthInvalidSessionProblem();
    expect(problem.code).toBe("auth-better-auth/invalid-session-payload");
  });

  it("should have correct category", () => {
    const problem = new BetterAuthInvalidSessionProblem();
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
  });

  it("should have correct message", () => {
    const problem = new BetterAuthInvalidSessionProblem();
    expect(problem.message).toBe("Better Auth session did not include a valid user payload");
  });

  it("should return 500 status", () => {
    const problem = new BetterAuthInvalidSessionProblem();
    expect(problem.status).toBe(500);
  });
});

describe("BetterAuthSessionLookupProblem", () => {
  it("should have correct code", () => {
    const problem = new BetterAuthSessionLookupProblem(new Error("upstream failed"));
    expect(problem.code).toBe("auth-better-auth/session-lookup-failed");
  });

  it("should have correct category", () => {
    const problem = new BetterAuthSessionLookupProblem(new Error("upstream failed"));
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
  });

  it("should preserve cause", () => {
    const cause = new Error("upstream failed");
    const problem = new BetterAuthSessionLookupProblem(cause);
    expect(problem.cause).toBe(cause);
  });

  it("should return 500 status", () => {
    const problem = new BetterAuthSessionLookupProblem(new Error("upstream failed"));
    expect(problem.status).toBe(500);
  });
});

describe("InvalidWebhookSignatureProblem", () => {
  it("should have correct code", () => {
    const problem = new InvalidWebhookSignatureProblem();
    expect(problem.code).toBe("auth-better-auth/invalid-webhook-signature");
  });

  it("should have correct category", () => {
    const problem = new InvalidWebhookSignatureProblem();
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
  });

  it("should return 401 status", () => {
    const problem = new InvalidWebhookSignatureProblem();
    expect(problem.status).toBe(401);
  });
});

describe("InvalidWebhookPayloadProblem", () => {
  it("should have correct code", () => {
    const problem = new InvalidWebhookPayloadProblem();
    expect(problem.code).toBe("auth-better-auth/invalid-webhook-payload");
  });

  it("should have correct category", () => {
    const problem = new InvalidWebhookPayloadProblem();
    expect(problem.category).toBe(ProblemCategory.BadRequest);
  });

  it("should return 400 status", () => {
    const problem = new InvalidWebhookPayloadProblem();
    expect(problem.status).toBe(400);
  });
});

describe("BetterAuthNotInitializedProblem", () => {
  it("should have correct code", () => {
    const problem = new BetterAuthNotInitializedProblem();
    expect(problem.code).toBe("auth-better-auth/not-initialized");
  });

  it("should have correct category", () => {
    const problem = new BetterAuthNotInitializedProblem();
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
  });
});

describe("BetterAuthSessionNotFoundProblem", () => {
  it("should include session id in message", () => {
    const problem = new BetterAuthSessionNotFoundProblem("session-123");
    expect(problem.message).toContain("session-123");
  });

  it("should have correct category", () => {
    const problem = new BetterAuthSessionNotFoundProblem("session-123");
    expect(problem.category).toBe(ProblemCategory.NotFound);
  });

  it("should return 404 status", () => {
    const problem = new BetterAuthSessionNotFoundProblem("session-123");
    expect(problem.status).toBe(404);
  });
});

describe("BetterAuthUserNotFoundProblem", () => {
  it("should include user id in message", () => {
    const problem = new BetterAuthUserNotFoundProblem("user-123");
    expect(problem.message).toContain("user-123");
  });

  it("should have correct category", () => {
    const problem = new BetterAuthUserNotFoundProblem("user-123");
    expect(problem.category).toBe(ProblemCategory.NotFound);
  });

  it("should return 404 status", () => {
    const problem = new BetterAuthUserNotFoundProblem("user-123");
    expect(problem.status).toBe(404);
  });
});
