import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";

import {
  CircuitBreaker,
  ExponentialBackoff,
  FixedBackoff,
  hasTimeForRetry,
  InvalidRetryConfigurationProblem,
  LambdaTimeoutGuard,
  RedisCircuitBreakerStore,
  Retryable,
  RetryOrchestrator,
  RetryTemplate,
} from "../index";

const NON_FINITE_VALUES = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const NON_INTEGER_VALUES = [0.5, 1.5];
const ABOVE_TIMER_MAX = 2_147_483_648;

function createRedisMock() {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK" as const),
    incr: vi.fn(async () => 1),
    del: vi.fn(async () => 0),
    expire: vi.fn(async () => 1),
    eval: vi.fn(async () => 1),
    scan: vi.fn(async (): Promise<[string, string[]]> => ["0", []]),
  };
}

describe("NumericConfiguration", () => {
  describe("circuit breaker options", () => {
    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid halfOpenRequests %s before state access",
      (halfOpenRequests) => {
        const getState = vi.fn();

        expect(
          () =>
            new CircuitBreaker({
              circuitId: "numeric-test",
              halfOpenRequests,
              stateStore: { getState } as never,
            }),
        ).toThrow(InvalidRetryConfigurationProblem);
        expect(getState).not.toHaveBeenCalled();
      },
    );

    it.each([1, Number.MAX_SAFE_INTEGER])(
      "accepts halfOpenRequests boundary %s",
      (halfOpenRequests) => {
        expect(
          () => new CircuitBreaker({ circuitId: "numeric-test", halfOpenRequests }),
        ).not.toThrow();
      },
    );

    it.each([1, Number.MAX_SAFE_INTEGER])(
      "accepts failureThreshold boundary %s",
      (failureThreshold) => {
        expect(
          () => new CircuitBreaker({ circuitId: "numeric-test", failureThreshold }),
        ).not.toThrow();
      },
    );

    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid failureThreshold %s",
      (failureThreshold) => {
        expect(() => new CircuitBreaker({ circuitId: "numeric-test", failureThreshold })).toThrow(
          InvalidRetryConfigurationProblem,
        );
      },
    );

    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid openDuration %s",
      (openDuration) => {
        expect(() => new CircuitBreaker({ circuitId: "numeric-test", openDuration })).toThrow(
          InvalidRetryConfigurationProblem,
        );
      },
    );

    it.each([1, 2_147_483_647])("accepts circuit timer boundary %s", (openDuration) => {
      expect(() => new CircuitBreaker({ circuitId: "numeric-test", openDuration })).not.toThrow();
    });
  });

  describe("retry attempt option", () => {
    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid maxAttempts %s",
      (maxAttempts) => {
        expect(() => new RetryTemplate({ maxAttempts })).toThrow(InvalidRetryConfigurationProblem);
      },
    );

    it.each([1, Number.MAX_SAFE_INTEGER])("accepts maxAttempts boundary %s", (maxAttempts) => {
      expect(() => new RetryTemplate({ maxAttempts })).not.toThrow();
    });

    it("rejects an invalid orchestrator maxAttempts before callbacks or listeners run", async () => {
      const callback = vi.fn(async () => "result");
      const onStart = vi.fn(() => true);

      await expect(
        RetryOrchestrator.execute("numeric-test", [], callback, {
          maxAttempts: Number.NaN,
          listeners: [{ onStart }],
        }),
      ).rejects.toThrow(InvalidRetryConfigurationProblem);
      expect(callback).not.toHaveBeenCalled();
      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe("backoff options", () => {
    it.each([-1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid delay %s before sleeping",
      (delay) => {
        const sleep = vi.fn();

        expect(() => new ExponentialBackoff({ delay }, { sleep })).toThrow(
          InvalidRetryConfigurationProblem,
        );
        expect(() => new FixedBackoff(delay, { sleep })).toThrow(InvalidRetryConfigurationProblem);
        expect(sleep).not.toHaveBeenCalled();
      },
    );

    it.each([0, 2_147_483_647])("accepts delay boundary %s", (delay) => {
      expect(
        new ExponentialBackoff({ delay, maxDelay: Math.max(1, delay), jitter: false }).getDelay(0),
      ).toBe(delay);
      expect(new FixedBackoff(delay).getDelay(0)).toBe(delay);
    });

    it.each([0, -1, ...NON_FINITE_VALUES])("rejects invalid multiplier %s", (multiplier) => {
      expect(() => new ExponentialBackoff({ multiplier })).toThrow(
        InvalidRetryConfigurationProblem,
      );
    });

    it.each([Number.MIN_VALUE, 0.5, 1, Number.MAX_VALUE])(
      "accepts positive finite multiplier %s",
      (multiplier) => {
        expect(() => new ExponentialBackoff({ multiplier })).not.toThrow();
      },
    );

    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid maxDelay %s",
      (maxDelay) => {
        expect(() => new ExponentialBackoff({ maxDelay })).toThrow(
          InvalidRetryConfigurationProblem,
        );
      },
    );

    it.each([1, 2_147_483_647])("accepts maxDelay boundary %s", (maxDelay) => {
      expect(() => new ExponentialBackoff({ maxDelay })).not.toThrow();
    });
  });

  describe("Lambda timeout options", () => {
    it.each([-1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid reserveTimeMs %s before reading remaining time",
      (reserveTimeMs) => {
        const getRemainingTime = vi.fn(() => 10_000);

        expect(() => new LambdaTimeoutGuard({ reserveTimeMs, getRemainingTime })).toThrow(
          InvalidRetryConfigurationProblem,
        );
        expect(() => hasTimeForRetry(1, { reserveTimeMs, getRemainingTime })).toThrow(
          InvalidRetryConfigurationProblem,
        );
        expect(getRemainingTime).not.toHaveBeenCalled();
      },
    );

    it.each([-1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid nextDelayMs %s before reading remaining time",
      (nextDelayMs) => {
        const getRemainingTime = vi.fn(() => 10_000);

        expect(() => hasTimeForRetry(nextDelayMs, { getRemainingTime })).toThrow(
          InvalidRetryConfigurationProblem,
        );
        expect(getRemainingTime).not.toHaveBeenCalled();
      },
    );

    it.each([0, 2_147_483_647])("accepts Lambda numeric boundary %s", (value) => {
      const getRemainingTime = () => Number.POSITIVE_INFINITY;

      expect(
        () => new LambdaTimeoutGuard({ reserveTimeMs: value, getRemainingTime }),
      ).not.toThrow();
      expect(hasTimeForRetry(value, { reserveTimeMs: 0, getRemainingTime })).toBe(true);
    });
  });

  describe("Redis TTL option", () => {
    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid ttlSeconds %s before Redis I/O",
      (ttlSeconds) => {
        const redis = createRedisMock();

        expect(() => new RedisCircuitBreakerStore({ redis, ttlSeconds })).toThrow(
          InvalidRetryConfigurationProblem,
        );
        expect(redis.get).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
        expect(redis.expire).not.toHaveBeenCalled();
      },
    );

    it.each([1, Number.MAX_SAFE_INTEGER])("accepts ttlSeconds boundary %s", (ttlSeconds) => {
      expect(
        () => new RedisCircuitBreakerStore({ redis: createRedisMock(), ttlSeconds }),
      ).not.toThrow();
    });
  });

  describe("Retryable decorator options", () => {
    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid circuitBreaker.successThreshold %s at decorator creation",
      (successThreshold) => {
        const circuitIdResolver = vi.fn(() => "numeric-test");

        expect(() =>
          Retryable({
            circuitBreaker: { failureThreshold: 1, successThreshold },
            circuitIdResolver,
          }),
        ).toThrow(InvalidRetryConfigurationProblem);
        expect(circuitIdResolver).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid circuitBreaker.timeout %s at decorator creation",
      (timeout) => {
        expect(() => Retryable({ circuitBreaker: { failureThreshold: 1, timeout } })).toThrow(
          InvalidRetryConfigurationProblem,
        );
      },
    );

    it.each([-1, ...NON_INTEGER_VALUES, ...NON_FINITE_VALUES, ABOVE_TIMER_MAX])(
      "rejects invalid lambdaTimeoutReserveMs %s at decorator creation",
      (lambdaTimeoutReserveMs) => {
        expect(() => Retryable({ lambdaTimeoutReserveMs })).toThrow(
          InvalidRetryConfigurationProblem,
        );
      },
    );

    it("rejects invalid retry and backoff options before resolver, state, or telemetry work", () => {
      const circuitIdResolver = vi.fn(() => "numeric-test");
      const getState = vi.fn();

      expect(() =>
        Retryable({
          maxAttempts: Number.NaN,
          backoff: { delay: -1 },
          circuitBreaker: {
            failureThreshold: 1,
            stateStore: { getState } as never,
          },
          circuitIdResolver,
        }),
      ).toThrow(InvalidRetryConfigurationProblem);
      expect(circuitIdResolver).not.toHaveBeenCalled();
      expect(getState).not.toHaveBeenCalled();
    });

    it.each([1, Number.MAX_SAFE_INTEGER])(
      "accepts Retryable positive safe-integer boundaries %s",
      (value) => {
        expect(() =>
          Retryable({
            maxAttempts: value,
            circuitBreaker: {
              failureThreshold: value,
              successThreshold: value,
            },
          }),
        ).not.toThrow();
      },
    );

    it.each([0, 2_147_483_647])("accepts Retryable non-negative timer boundaries %s", (value) => {
      expect(() =>
        Retryable({
          backoff: { delay: value },
          lambdaTimeoutReserveMs: value,
        }),
      ).not.toThrow();
    });

    it.each([1, 2_147_483_647])("accepts Retryable positive timer boundaries %s", (value) => {
      expect(() =>
        Retryable({
          backoff: { maxDelay: value },
          circuitBreaker: { failureThreshold: 1, timeout: value },
        }),
      ).not.toThrow();
    });

    it("ignores declarative backoff values when a custom backoff policy is active", () => {
      const backoffPolicy = {
        getDelay: vi.fn(() => 0),
        wait: vi.fn(async () => undefined),
        reset: vi.fn(),
      };

      expect(() =>
        Retryable({
          backoff: { delay: Number.NaN, multiplier: 0, maxDelay: -1 },
          backoffPolicy,
        }),
      ).not.toThrow();
    });
  });

  it("exposes stable typed Problem metadata without embedding the received value in detail", () => {
    let problem: InvalidRetryConfigurationProblem | undefined;

    try {
      new ExponentialBackoff({ delay: Number.NaN });
    } catch (error) {
      if (error instanceof InvalidRetryConfigurationProblem) {
        problem = error;
      }
    }

    expect(problem).toBeInstanceOf(InvalidRetryConfigurationProblem);
    expect(problem?.code).toBe("INVALID_RETRY_CONFIGURATION");
    expect(problem?.category).toBe(ProblemCategory.ValidationError);
    expect(problem?.detail).toBe(
      "Retry option 'backoff.delay' must satisfy 'non-negative-timer-integer'",
    );
    expect(problem?.extensions).toEqual({
      option: "backoff.delay",
      constraint: "non-negative-timer-integer",
      received: "NaN",
    });
  });
});
