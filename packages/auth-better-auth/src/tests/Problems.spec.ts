import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  BetterAuthNotInitializedProblem,
  BetterAuthSessionNotFoundProblem,
  BetterAuthUserNotFoundProblem,
} from "../libs/problems/AuthProblems";
import { BetterAuthAuthenticationProblem } from "../libs/problems/BetterAuthAuthenticationProblem";
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

describe("BetterAuthAuthenticationProblem", () => {
  it("should have stable code and category", () => {
    const problem = new BetterAuthAuthenticationProblem("authenticate", {
      status: 503,
      message: "Better Auth temporarily unavailable",
    });

    expect(problem.code).toBe("auth-better-auth/authentication-failed");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.extensions).toMatchObject({
      operation: "authenticate",
      provider: "better-auth",
      retryable: true,
      upstreamStatus: 503,
    });
  });

  it("should redact sensitive detail values", () => {
    const problem = new BetterAuthAuthenticationProblem("readiness", {
      message: "token=tok_123 better-auth-url=https://secret.example.com",
    });

    expect(problem.detail).toBe(
      "Better Auth readiness failed: token=[Redacted] better-auth-url=[Redacted]",
    );
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

describe("Upstream error cause boundary", () => {
  it("preserves redacted Error diagnostics without retaining upstream payloads (1)", () => {
    const cause = Object.assign(new Error("token=cause-secret"), {
      status: 503,
      response: { headers: { authorization: "Bearer private-header" } },
      nested: new Error("private-nested-cause"),
    });
    cause.stack = "Error: token=cause-secret\n    at request (upstream-sdk.js:17:9)";
    const problem = new BetterAuthAuthenticationProblem("authenticate", cause);
    expect(problem.cause).toBeInstanceOf(Error);
    expect(problem.cause?.stack).toContain("upstream-sdk.js:17:9");
    expect(problem.cause).not.toBe(cause);
    expect(problem.cause?.message).toBe("token=[Redacted]");
    expect(problem.cause?.stack).toContain("token=[Redacted]");
    expect(problem.cause).not.toHaveProperty("response");
    expect(problem.cause).not.toHaveProperty("nested");
    expect(cause.message).toBe("token=cause-secret");
    expect(cause.stack).toContain("token=cause-secret");
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(problem.extensions).toMatchObject({ upstreamStatus: 503 });
    for (const serialized of [JSON.stringify(problem), JSON.stringify({ ...problem })]) {
      expect(serialized).not.toContain("cause-secret");
      expect(serialized).not.toContain("private-header");
      expect(serialized).not.toContain("private-nested-cause");
    }
    expect(problem.toJSON()).not.toHaveProperty("cause");
  });
  it("does not promote non-Error input to a cause (1)", () => {
    const problem = new BetterAuthAuthenticationProblem("authenticate", {
      status: 503,
      message: "unavailable",
    });
    expect(problem.cause).toBeUndefined();
    expect(problem.toJSON()).not.toHaveProperty("cause");
  });
});

describe("Revocation cause privacy", () => {
  it.each(["revokeSession", "revokeUserSessions"] as const)(
    "keeps %s cause generic",
    (operation) => {
      const cause = new Error("bare-sensitive-session-value");
      const problem = new BetterAuthAuthenticationProblem(operation, cause);
      expect(problem.cause).toBeInstanceOf(Error);
      expect(problem.cause?.message).toBe("upstream revocation failed");
      expect(problem.cause?.stack).not.toContain("bare-sensitive-session-value");
      expect(JSON.stringify(problem)).not.toContain("bare-sensitive-session-value");
      expect(cause.message).toBe("bare-sensitive-session-value");
    },
  );
});

describe("Upstream stack header privacy", () => {
  it("redacts complete authorization and cookie values while retaining source frames", () => {
    const cause = new Error("upstream unavailable");
    cause.stack =
      "Error: upstream unavailable\nAuthorization: Bearer credential-fragment\nCookie: sid=first-cookie; session=second-cookie\n    at request (upstream-sdk.js:17:9)";
    const problem = new BetterAuthAuthenticationProblem("authenticate", cause);
    expect(problem.cause?.stack).toContain("upstream-sdk.js:17:9");
    for (const secret of ["credential-fragment", "first-cookie", "second-cookie"]) {
      expect(problem.cause?.stack).not.toContain(secret);
      expect(JSON.stringify(problem)).not.toContain(secret);
    }
    expect(cause.stack).toContain("credential-fragment");
  });
});
