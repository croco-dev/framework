import { ProblemFactory } from "@croco/problems-core";
import { getActiveTraceInfo } from "@croco/telemetry-api";
import { describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerBookkeepingProblem,
  CircuitState,
  DefaultRetryPolicy,
  InMemoryCircuitBreakerStateStore,
  type OnStoreError,
  RedisCircuitBreakerStore,
  type RedisCircuitBreakerStoreOptions,
  type RetryHooks,
  RetrySuccessHookProblem,
  RetryTemplate,
} from "../index";

function createRootExportRedis(): RedisCircuitBreakerStoreOptions["redis"] {
  const data = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(
      async (
        key: string,
        value: string,
        _opts?: { ex?: number; nx?: boolean },
      ): Promise<"OK" | null> => {
        data.set(key, value);
        return "OK";
      },
    ),
    incr: vi.fn(async (key: string) => {
      const next = Number(data.get(key) ?? "0") + 1;
      data.set(key, String(next));
      return next;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;

      for (const key of keys) {
        if (data.delete(key)) {
          deleted += 1;
        }
      }

      return deleted;
    }),
    expire: vi.fn(async () => 1),
    eval: vi.fn(async () => 1),
    scan: vi.fn(async (): Promise<[string, string[]]> => ["0", []]),
  };
}

describe("retry-core public exports", () => {
  it.each([CircuitState.CLOSED, CircuitState.HALF_OPEN])(
    "retains both failures and incomplete state without an active span in %s",
    async (state) => {
      expect(getActiveTraceInfo()).toEqual({});
      const now = () => 10_000;
      const stateStore = new InMemoryCircuitBreakerStateStore({ now });
      await stateStore.setState("no-span", state);
      const operationError = Object.freeze(
        Object.assign(new Error("upstream unavailable"), { retryable: false }),
      );
      const bookkeepingError = new Error("state store unavailable");
      if (state === CircuitState.CLOSED) {
        vi.spyOn(stateStore, "incrementFailureAndCheck").mockRejectedValueOnce(bookkeepingError);
      } else {
        vi.spyOn(stateStore, "setLastFailureTime").mockRejectedValueOnce(bookkeepingError);
      }
      const breaker = new CircuitBreaker({ circuitId: "no-span", stateStore, now });

      const failure = await breaker
        .execute(async () => Promise.reject(operationError))
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(CircuitBreakerBookkeepingProblem);
      expect(failure).toMatchObject({
        cause: operationError,
        operationError,
        bookkeepingError,
        extensions: { bookkeepingRecorded: false, operationSucceeded: false, state },
      });
      if (failure instanceof CircuitBreakerBookkeepingProblem) {
        expect(failure.operationError).toBe(operationError);
        expect(failure.cause).toBe(operationError);
        expect(failure.bookkeepingError).toBe(bookkeepingError);
        expect(new DefaultRetryPolicy().shouldRetry(failure, 1, 3)).toBe(false);
      }
    },
  );

  it("keeps raw failures out of public JSON and enumerable properties", () => {
    const operationError = Object.assign(new Error("upstream-private-token"), { retryable: false });
    const bookkeepingError = new Error("store-private-password");
    const failure = new CircuitBreakerBookkeepingProblem(
      "billing",
      CircuitState.CLOSED,
      operationError,
      bookkeepingError,
    );

    expect(failure.cause).toBe(operationError);
    expect(failure.bookkeepingError).toBe(bookkeepingError);
    expect(failure.toJSON()).toMatchObject({
      code: "retry-core/circuit-bookkeeping-failed",
      status: 500,
      circuitId: "billing",
      state: CircuitState.CLOSED,
      operationSucceeded: false,
      bookkeepingRecorded: false,
      retryable: false,
    });
    for (const serialized of [JSON.stringify(failure), JSON.stringify({ ...failure })]) {
      expect(serialized).not.toContain("upstream-private-token");
      expect(serialized).not.toContain("store-private-password");
    }
    expect(Object.keys(failure)).not.toContain("operationError");
    expect(Object.keys(failure)).not.toContain("bookkeepingError");
  });

  it.each([
    [ProblemFactory.notFound("missing"), false],
    [ProblemFactory.internalServerError("transient"), true],
    [Object.assign(ProblemFactory.conflict("retryable conflict"), { retryable: true }), true],
    [Object.assign(ProblemFactory.internalServerError("terminal"), { retryable: false }), false],
    [Object.assign(new TypeError("programmer error"), { retryable: true }), false],
  ])(
    "classifies the original operation inside a bookkeeping Problem: %s",
    (operationError, expected) => {
      const failure = new CircuitBreakerBookkeepingProblem(
        "policy",
        CircuitState.CLOSED,
        operationError,
        new Error("store failed"),
      );
      const nested = new CircuitBreakerBookkeepingProblem(
        "outer",
        CircuitState.CLOSED,
        failure,
        new Error("outer store failed"),
      );
      expect(new DefaultRetryPolicy().shouldRetry(failure, 1, 3)).toBe(expected);
      expect(new DefaultRetryPolicy().shouldRetry(nested, 1, 3)).toBe(expected);
    },
  );

  it("passes the operation error to a custom retry policy while retaining both failures", async () => {
    const operationError = Object.assign(new Error("do not retry"), { retryable: false });
    const bookkeepingError = new Error("store failed");
    const now = () => 0;
    const stateStore = new InMemoryCircuitBreakerStateStore({ now });
    vi.spyOn(stateStore, "incrementFailureAndCheck").mockRejectedValueOnce(bookkeepingError);
    const breaker = new CircuitBreaker({ circuitId: "custom-policy", stateStore, now });
    const shouldRetry = vi.fn(() => false);
    const retry = new RetryTemplate({ maxAttempts: 2, retryPolicy: { shouldRetry } });
    const fn = vi.fn(async () => Promise.reject(operationError));

    await expect(retry.execute(() => breaker.execute(fn))).rejects.toMatchObject({
      operationError,
      bookkeepingError,
    });
    expect(shouldRetry).toHaveBeenCalledExactlyOnceWith(operationError, 1, 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never retries a successful callback's failed hook hidden inside bookkeeping failure", async () => {
    const operationError = new RetrySuccessHookProblem("charge", 1, new Error("hook failed"));
    const now = () => 0;
    const stateStore = new InMemoryCircuitBreakerStateStore({ now });
    vi.spyOn(stateStore, "incrementFailureAndCheck").mockRejectedValueOnce(
      new Error("store failed"),
    );
    const breaker = new CircuitBreaker({ circuitId: "success-hook", stateStore, now });
    const shouldRetry = vi.fn(() => true);
    const retry = new RetryTemplate({ maxAttempts: 3, retryPolicy: { shouldRetry } });
    const fn = vi.fn(async () => Promise.reject(operationError));

    await expect(retry.execute(() => breaker.execute(fn))).rejects.toMatchObject({
      operationError,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("retains an undefined ignored rejection when HALF_OPEN slot release fails", async () => {
    const now = () => 0;
    const stateStore = new InMemoryCircuitBreakerStateStore({ now });
    await stateStore.setState("undefined-error", CircuitState.HALF_OPEN);
    const bookkeepingError = new Error("slot release failed");
    const breaker = new CircuitBreaker({
      circuitId: "undefined-error",
      stateStore,
      now,
      recordFailure: () => false,
    });
    const fn = async () => {
      vi.spyOn(stateStore, "setHalfOpenActiveCount").mockRejectedValueOnce(bookkeepingError);
      return Promise.reject(undefined);
    };

    const shouldRetry = vi.fn(() => false);
    const retry = new RetryTemplate({ maxAttempts: 2, retryPolicy: { shouldRetry } });
    await expect(retry.execute(() => breaker.execute(fn))).rejects.toMatchObject({
      operationError: undefined,
      bookkeepingError,
    });
    expect(shouldRetry).toHaveBeenCalledExactlyOnceWith(expect.any(Error), 1, 2);
  });

  it("exports the README-documented Redis circuit breaker store from the package root", async () => {
    const onStoreError: OnStoreError = "throw";
    const store = new RedisCircuitBreakerStore({
      onStoreError,
      redis: createRootExportRedis(),
    });

    await store.setState("root-export", CircuitState.CLOSED);

    expect(store).toBeInstanceOf(RedisCircuitBreakerStore);
    await expect(store.getState("root-export")).resolves.toBe(CircuitState.CLOSED);
  });

  it("exports typed success hook failure semantics from the package root", () => {
    const hooks: RetryHooks = {
      onSuccess: vi.fn(),
    };
    const cause = new Error("telemetry unavailable");
    const problem = new RetrySuccessHookProblem("charge", 1, cause);

    expect(hooks.onSuccess).toBeTypeOf("function");
    expect(problem).toMatchObject({
      cause,
      code: "retry-core/success-hook-failed",
      extensions: {
        attempt: 1,
        callbackSucceeded: true,
        hook: "onSuccess",
        methodName: "charge",
      },
    });
  });
});
