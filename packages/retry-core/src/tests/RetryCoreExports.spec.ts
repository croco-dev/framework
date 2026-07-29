import { describe, expect, it, vi } from "vitest";
import {
  CircuitState,
  type OnStoreError,
  RedisCircuitBreakerStore,
  type RedisCircuitBreakerStoreOptions,
  type RetryHooks,
  RetrySuccessHookProblem,
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
