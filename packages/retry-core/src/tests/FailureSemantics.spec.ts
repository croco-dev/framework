import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenProblem,
  DefaultRetryPolicy,
  LambdaTimeoutGuard,
  LambdaTimeoutProblem,
  NoBackoff,
  RetrySuccessHookProblem,
  RetryTemplate,
} from "../index";

class TransientProviderProblem extends Problem {
  constructor() {
    super("TEST_PROVIDER_UNAVAILABLE", ProblemCategory.InternalServerError, "Provider unavailable");
  }
}

class TerminalBusinessProblem extends Problem {
  constructor() {
    super(
      "TEST_BUSINESS_RULE_FAILED",
      ProblemCategory.BusinessRuleViolation,
      "Business rule failed",
    );
  }
}

class ClassifiedProviderProblem extends Problem {
  constructor(category: ProblemCategory, retryable: boolean) {
    super("TEST_CLASSIFIED_PROVIDER_FAILURE", category, "Provider failed", {
      extensions: { retryable },
    });
  }
}

class GatewayError extends Error {}

describe("Croco failure semantics", () => {
  it("classifies transient and terminal Problems through the default retry policy", () => {
    const policy = new DefaultRetryPolicy();

    expect(policy.shouldRetry(new TransientProviderProblem(), 1, 3)).toBe(true);
    expect(policy.shouldRetry(new TerminalBusinessProblem(), 1, 3)).toBe(false);
    expect(policy.shouldRetry(new TypeError("programmer error"), 1, 3)).toBe(false);
  });

  it("never classifies a completed callback's success hook failure as retryable", () => {
    const policy = new DefaultRetryPolicy();
    const hookFailure = new RetrySuccessHookProblem(
      "charge",
      1,
      new Error("telemetry unavailable"),
    );

    expect(policy.shouldRetry(hookFailure, 1, 3)).toBe(false);
  });

  it("stops retrying terminal Problem categories before attempts are exhausted", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });
    const operation = vi.fn(async () => {
      throw new TerminalBusinessProblem();
    });

    await expect(template.execute(operation)).rejects.toThrow(TerminalBusinessProblem);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries transient Problem categories until success", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TransientProviderProblem())
      .mockResolvedValue("ok");

    await expect(template.execute(operation)).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it.each([ProblemCategory.InternalServerError, ProblemCategory.TooManyRequests])(
    "does not retry a %s Problem that declares extensions.retryable=false",
    (category) => {
      const policy = new DefaultRetryPolicy();

      expect(policy.shouldRetry(new ClassifiedProviderProblem(category, false), 1, 3)).toBe(false);
    },
  );

  it.each([ProblemCategory.Conflict, ProblemCategory.BusinessRuleViolation])(
    "retries a %s Problem that declares extensions.retryable=true while attempts remain",
    (category) => {
      const policy = new DefaultRetryPolicy();
      const problem = new ClassifiedProviderProblem(category, true);

      expect(policy.shouldRetry(problem, 1, 3)).toBe(true);
      expect(policy.shouldRetry(problem, 3, 3)).toBe(false);
    },
  );

  it("prefers a top-level retryable flag over extensions.retryable", () => {
    const policy = new DefaultRetryPolicy();
    const terminal = Object.assign(
      new ClassifiedProviderProblem(ProblemCategory.InternalServerError, true),
      { retryable: false },
    );
    const transient = Object.assign(
      new ClassifiedProviderProblem(ProblemCategory.Conflict, false),
      {
        retryable: true,
      },
    );

    expect(policy.shouldRetry(terminal, 1, 3)).toBe(false);
    expect(policy.shouldRetry(transient, 1, 3)).toBe(true);
  });

  it("keeps noRetryFor ahead of an explicit retryable=true", () => {
    const policy = new DefaultRetryPolicy();
    const programmerError = Object.assign(new TypeError("programmer error"), { retryable: true });

    expect(policy.shouldRetry(programmerError, 1, 3)).toBe(false);
  });

  it("applies an explicit retryable flag before retryFor classes", () => {
    const policy = new DefaultRetryPolicy({ retryFor: [GatewayError] });

    expect(
      policy.shouldRetry(Object.assign(new GatewayError("gateway"), { retryable: false }), 1, 3),
    ).toBe(false);
    expect(policy.shouldRetry(Object.assign(new Error("other"), { retryable: true }), 1, 3)).toBe(
      true,
    );
  });

  it("runs an InternalServerError Problem declaring retryable=false once under the default RetryTemplate policy", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });
    const problem = new ClassifiedProviderProblem(ProblemCategory.InternalServerError, false);
    const operation = vi.fn(async () => {
      throw problem;
    });

    await expect(template.execute(operation)).rejects.toBe(problem);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a Conflict Problem declaring retryable=true until attempts are exhausted", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });
    const problem = new ClassifiedProviderProblem(ProblemCategory.Conflict, true);
    const operation = vi.fn(async () => {
      throw problem;
    });

    await expect(template.execute(operation)).rejects.toBe(problem);

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("exposes timeout guard failures as a typed Problem from the package root", () => {
    const detail = "Lambda timeout guard: 40ms remaining, need 51ms";
    const guard = new LambdaTimeoutGuard({
      reserveTimeMs: 50,
      getRemainingTime: () => 40,
    });

    expect(() => guard.checkTimeout(1)).toThrow(LambdaTimeoutProblem);

    try {
      guard.checkTimeout(1);
      throw new Error("Expected LambdaTimeoutProblem");
    } catch (error) {
      expect(error).toBeInstanceOf(LambdaTimeoutProblem);
      expect(error).toMatchObject({
        category: ProblemCategory.InternalServerError,
        code: "LAMBDA_TIMEOUT_GUARD",
        detail,
      });
      expect((error as LambdaTimeoutProblem).toJSON()).toMatchObject({
        code: "LAMBDA_TIMEOUT_GUARD",
        detail,
        status: 500,
      });
    }
  });

  it("exposes an open circuit as a retry-aware Problem category", async () => {
    const breaker = new CircuitBreaker({
      circuitId: "failure-semantics",
      failureThreshold: 1,
      openDuration: 30_000,
    });

    await expect(
      breaker.execute(async () => {
        throw new TransientProviderProblem();
      }),
    ).rejects.toThrow(TransientProviderProblem);

    await expect(breaker.execute(async () => "ok")).rejects.toMatchObject({
      category: ProblemCategory.TooManyRequests,
      code: "CIRCUIT_BREAKER_OPEN",
    });
    await expect(breaker.execute(async () => "ok")).rejects.toThrow(CircuitBreakerOpenProblem);
  });
});
