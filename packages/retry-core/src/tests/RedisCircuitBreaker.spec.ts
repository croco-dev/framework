import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";

import { Retryable } from "../libs/Retryable";
import { CircuitBreaker } from "../libs/CircuitBreaker";
import { CircuitState } from "../libs/CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "../libs/errors/CircuitBreakerOpenProblem";
import {
  CircuitBreakerLockProblem,
  InvalidRetryConfigurationProblem,
} from "../libs/errors/RetryInfrastructureProblem";
import { RedisCircuitBreakerStore } from "../libs/stores/RedisCircuitBreakerStore";

type MockUpstashRedis = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex?: number; nx?: boolean }) => Promise<"OK" | null>;
  incr: (key: string) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>;
  scan: (cursor: number) => Promise<[string, string[]]>;
};

function createSharedMockRedis(): { redis: MockUpstashRedis; data: Map<string, string> } {
  const data = new Map<string, string>();

  const redis: MockUpstashRedis = {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(
      async (
        key: string,
        value: string,
        opts?: { ex?: number; nx?: boolean },
      ): Promise<"OK" | null> => {
        if (opts?.nx && data.has(key)) {
          return null;
        }
        data.set(key, value);
        return "OK";
      },
    ),
    incr: vi.fn(async (key: string) => {
      const current = Number(data.get(key) ?? "0");
      const next = current + 1;
      data.set(key, String(next));
      return next;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        deleted += data.delete(key) ? 1 : 0;
      }
      return deleted;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
    eval: vi.fn(async (_script: string, keys: string[], args: string[]) => {
      const [key] = keys;
      const [ownerToken] = args;
      if (key && ownerToken && data.get(key) === ownerToken) {
        data.delete(key);
        return 1;
      }
      return 0;
    }),
    scan: vi.fn(async (): Promise<[string, string[]]> => ["0", [...data.keys()]]),
  };

  return { redis, data };
}

function createExpiringRedis(now: () => number): MockUpstashRedis {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const read = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    get: async (key) => read(key)?.value ?? null,
    set: async (key, value, options) => {
      if (options?.nx && read(key)) return null;
      data.set(key, {
        value,
        expiresAt: options?.ex === undefined ? null : now() + options.ex * 1000,
      });
      return "OK";
    },
    incr: async (key) => {
      const entry = read(key);
      const next = Number(entry?.value ?? "0") + 1;
      data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    del: async (...keys) => {
      let deleted = 0;
      for (const key of keys) {
        if (read(key) && data.delete(key)) deleted += 1;
      }
      return deleted;
    },
    expire: async (key, seconds) => {
      const entry = read(key);
      if (!entry) return 0;
      entry.expiresAt = now() + seconds * 1000;
      return 1;
    },
    eval: async (_script, keys, args) => {
      const [key] = keys;
      if (key && read(key)?.value === args[0]) {
        data.delete(key);
        return 1;
      }
      return 0;
    },
    scan: async () => ["0", [...data.keys()].filter((key) => read(key) !== undefined)],
  };
}

function createFailingMockRedis(): MockUpstashRedis {
  return {
    get: vi.fn(async () => {
      throw new Error("redis-down");
    }),
    set: vi.fn(
      async (_key: string, _value: string, _opts?: { ex?: number }): Promise<"OK" | null> => {
        throw new Error("redis-down");
      },
    ),
    incr: vi.fn(async () => {
      throw new Error("redis-down");
    }),
    del: vi.fn(async () => {
      throw new Error("redis-down");
    }),
    expire: vi.fn(async () => {
      throw new Error("redis-down");
    }),
    eval: vi.fn(async () => {
      throw new Error("redis-down");
    }),
    scan: vi.fn(async () => {
      throw new Error("redis-down");
    }),
  };
}

describe("RedisCircuitBreakerStore", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("키 포맷은 croco:cb:{name}:state 여야 한다", async () => {
    const { redis } = createSharedMockRedis();
    const store = new RedisCircuitBreakerStore({
      redis: redis as unknown as never,
    });

    await store.setState("my-circuit", CircuitState.OPEN);

    expect(redis.set).toHaveBeenCalledWith("croco:cb:my-circuit:state", CircuitState.OPEN, {
      ex: 60,
    });
  });

  it("여러 인스턴스에서 Circuit Breaker 상태가 공유되어야 한다", async () => {
    const { redis } = createSharedMockRedis();

    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });

    const breakerA = new CircuitBreaker({
      circuitId: "shared-circuit",
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: storeA,
    });

    const breakerB = new CircuitBreaker({
      circuitId: "shared-circuit",
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: storeB,
    });

    await expect(breakerA.execute(async () => Promise.reject(new Error("fail")))).rejects.toThrow(
      "fail",
    );

    await expect(breakerB.execute(async () => "ok")).rejects.toThrow(CircuitBreakerOpenProblem);
    await expect(breakerB.getState()).resolves.toBe(CircuitState.OPEN);
  });

  it("shares caller-error exclusion and dependency-failure counting across Redis-backed breakers", async () => {
    const { redis } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const breakerA = new CircuitBreaker({
      circuitId: "classified-circuit",
      failureThreshold: 2,
      stateStore: storeA,
    });
    const breakerB = new CircuitBreaker({
      circuitId: "classified-circuit",
      failureThreshold: 2,
      stateStore: storeB,
    });
    const callerProblem = ProblemFactory.notFound("missing");
    const serverProblem = ProblemFactory.internalServerError("server");

    await expect(breakerA.execute(async () => Promise.reject(callerProblem))).rejects.toBe(
      callerProblem,
    );
    await expect(breakerB.execute(async () => Promise.reject(callerProblem))).rejects.toBe(
      callerProblem,
    );
    await expect(breakerA.getFailureCount()).resolves.toBe(0);
    await expect(breakerB.execute(async () => Promise.reject(serverProblem))).rejects.toBe(
      serverProblem,
    );
    await expect(breakerA.execute(async () => Promise.reject(serverProblem))).rejects.toBe(
      serverProblem,
    );
    await expect(breakerB.getState()).resolves.toBe(CircuitState.OPEN);
    await expect(breakerB.getFailureCount()).resolves.toBe(2);
  });

  it("returns a Redis-backed half-open slot after a caller Problem", async () => {
    const { redis } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const breakerA = new CircuitBreaker({ circuitId: "redis-half-open", stateStore: storeA });
    const breakerB = new CircuitBreaker({ circuitId: "redis-half-open", stateStore: storeB });
    const problem = ProblemFactory.validationError("invalid");
    await storeA.setState("redis-half-open", CircuitState.HALF_OPEN);

    await expect(breakerA.execute(async () => Promise.reject(problem))).rejects.toBe(problem);
    await expect(breakerB.getState()).resolves.toBe(CircuitState.HALF_OPEN);
    await expect(storeB.getHalfOpenActiveCount("redis-half-open")).resolves.toBe(0);
    await expect(breakerB.execute(async () => "healthy")).resolves.toBe("healthy");
    await expect(breakerA.getState()).resolves.toBe(CircuitState.CLOSED);
  });

  it("does not release a newer Redis-backed half-open cycle's slot from an old probe", async () => {
    const { redis } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const breakerA = new CircuitBreaker({
      circuitId: "redis-cycles",
      halfOpenRequests: 2,
      openDuration: 1,
      stateStore: storeA,
    });
    const breakerB = new CircuitBreaker({
      circuitId: "redis-cycles",
      halfOpenRequests: 2,
      openDuration: 1,
      stateStore: storeB,
    });
    const problem = ProblemFactory.notFound("missing");
    let rejectOld!: (error: Error) => void;
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    await storeA.setState("redis-cycles", CircuitState.HALF_OPEN);

    const oldProbe = breakerA
      .execute(() => new Promise<string>((_resolve, reject) => (rejectOld = reject)))
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(rejectOld).toBeDefined());
    await expect(
      breakerB.execute(async () => Promise.reject(new Error("dependency failed"))),
    ).rejects.toThrow("dependency failed");
    await storeB.setLastFailureTime("redis-cycles", Date.now() - 2);

    const firstNewProbe = breakerA.execute(
      () => new Promise<string>((resolve) => (resolveFirst = resolve)),
    );
    await vi.waitFor(() => expect(resolveFirst).toBeDefined());
    const secondNewProbe = breakerB.execute(
      () => new Promise<string>((resolve) => (resolveSecond = resolve)),
    );
    await vi.waitFor(() => expect(resolveSecond).toBeDefined());
    expect(await storeB.getHalfOpenActiveCount("redis-cycles")).toBe(2);

    rejectOld(problem);
    await expect(oldProbe).resolves.toBe(problem);
    expect(await storeA.getHalfOpenActiveCount("redis-cycles")).toBe(2);
    const extraProbe = vi.fn(async () => "unexpected");
    await expect(breakerA.execute(extraProbe)).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(extraProbe).not.toHaveBeenCalled();

    resolveFirst("first");
    resolveSecond("second");
    await expect(firstNewProbe).resolves.toBe("first");
    await expect(secondNewProbe).resolves.toBe("second");
  });

  it("keeps the half-open generation available until its Redis state expires", async () => {
    const { redis, data } = createSharedMockRedis();
    const expiresAt = new Map<string, number>();
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const baseGet = redis.get;
    const baseSet = redis.set;
    redis.get = vi.fn(async (key: string) => {
      if ((expiresAt.get(key) ?? Number.POSITIVE_INFINITY) <= now) {
        data.delete(key);
        expiresAt.delete(key);
      }
      return baseGet(key);
    });
    redis.set = vi.fn(
      async (key: string, value: string, options?: { ex?: number; nx?: boolean }) => {
        const result = await baseSet(key, value, options);
        if (result === "OK" && options?.ex !== undefined) {
          expiresAt.set(key, now + options.ex * 1000);
        }
        now += 1;
        return result;
      },
    );
    const store = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const breaker = new CircuitBreaker({
      circuitId: "redis-generation-ttl",
      failureThreshold: 1,
      openDuration: 30_000,
      stateStore: store,
    });
    const problem = ProblemFactory.notFound("missing");
    let rejectProbe!: (error: Error) => void;
    await store.setLastFailureTime("redis-generation-ttl", 0);
    await store.setState("redis-generation-ttl", CircuitState.OPEN);

    now = 30_010;
    const probe = breaker.execute(
      () => new Promise<string>((_resolve, reject) => (rejectProbe = reject)),
    );
    await vi.waitFor(() => expect(rejectProbe).toBeDefined());
    expect(await breaker.getState()).toBe(CircuitState.HALF_OPEN);
    expect(await store.getHalfOpenActiveCount("redis-generation-ttl")).toBe(1);
    now = 60_010;
    expect(await store.getLastFailureTime("redis-generation-ttl")).toBe(0);
    rejectProbe(problem);
    await expect(probe).rejects.toBe(problem);
    expect(await store.getHalfOpenActiveCount("redis-generation-ttl")).toBe(0);
    await expect(breaker.execute(async () => "healthy")).resolves.toBe("healthy");
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("Redis 오류 발생 시 인메모리로 자동 전환되어야 한다", async () => {
    const redis = createFailingMockRedis();
    const store = new RedisCircuitBreakerStore({
      onStoreError: "fallback-inmemory",
      redis: redis as unknown as never,
    });

    // 첫 Redis 호출에서 fallback 활성화
    await expect(store.getState("circuit-1")).resolves.toBe(CircuitState.CLOSED);
    expect(redis.get).toHaveBeenCalledTimes(1);

    // fallback 이후에는 Redis를 더 호출하지 않아야 한다
    expect(redis.set).toHaveBeenCalledTimes(0);

    const breaker = new CircuitBreaker({
      circuitId: "circuit-1",
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: store,
    });

    // 첫 실행: 실패 → CB OPEN
    await expect(breaker.execute(async () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    // 두 번째 실행: CB OPEN이므로 CircuitBreakerOpenProblem
    await expect(breaker.execute(async () => "ok")).rejects.toThrow(CircuitBreakerOpenProblem);
  });

  it("Redis lock command 오류만 fallback-inmemory를 활성화해야 한다", async () => {
    const redis = createFailingMockRedis();
    const store = new RedisCircuitBreakerStore({
      onStoreError: "fallback-inmemory",
      redis: redis as unknown as never,
    });

    await expect(store.withCircuitLock("redis-outage", async () => "fallback")).resolves.toBe(
      "fallback",
    );
    await expect(store.getState("redis-outage")).resolves.toBe(CircuitState.CLOSED);
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("일반 락 경합은 bounded retry 후 성공해야 한다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { redis } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    let releaseOwner: (() => void) | undefined;
    const ownerOperation = storeA.withCircuitLock(
      "contended",
      () => new Promise<void>((resolve) => (releaseOwner = resolve)),
    );
    await vi.waitFor(() => expect(releaseOwner).toBeDefined());

    const waiterOperation = storeB.withCircuitLock("contended", async () => "acquired");
    await vi.waitFor(() => expect(redis.set).toHaveBeenCalledTimes(2));
    releaseOwner?.();
    await ownerOperation;
    await vi.runAllTimersAsync();

    await expect(waiterOperation).resolves.toBe("acquired");
    expect(redis.set).toHaveBeenCalledTimes(3);
  });

  it("stale owner는 TTL rollover 후 successor 락을 삭제하지 않아야 한다", async () => {
    const { redis, data } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    let releaseOwner: (() => void) | undefined;
    let releaseSuccessor: (() => void) | undefined;
    const lockKey = "croco:cb:rollover:lock";

    const ownerOperation = storeA.withCircuitLock(
      "rollover",
      () => new Promise<void>((resolve) => (releaseOwner = resolve)),
    );
    await vi.waitFor(() => expect(releaseOwner).toBeDefined());
    const ownerToken = data.get(lockKey);
    expect(ownerToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(ownerToken).not.toContain("rollover");
    data.delete(lockKey);

    const successorOperation = storeB.withCircuitLock(
      "rollover",
      () => new Promise<void>((resolve) => (releaseSuccessor = resolve)),
    );
    await vi.waitFor(() => expect(releaseSuccessor).toBeDefined());
    const successorToken = data.get(lockKey);
    expect(successorToken).not.toBe(ownerToken);

    releaseOwner?.();
    await ownerOperation;
    expect(data.get(lockKey)).toBe(successorToken);

    releaseSuccessor?.();
    await successorOperation;
    expect(data.has(lockKey)).toBe(false);
  });

  it("contention deadline exhaustion은 fallback을 활성화하지 않아야 한다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { redis } = createSharedMockRedis();
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({
      onStoreError: "fallback-inmemory",
      redis: redis as unknown as never,
    });
    let releaseOwner: (() => void) | undefined;
    const sensitiveCircuitId = "tenant-secret@example.com";
    const ownerOperation = storeA.withCircuitLock(
      sensitiveCircuitId,
      () => new Promise<void>((resolve) => (releaseOwner = resolve)),
    );
    await vi.waitFor(() => expect(releaseOwner).toBeDefined());

    const exhausted = storeB.withCircuitLock(sensitiveCircuitId, async () => "unexpected");
    const errorPromise = exhausted.catch((reason: unknown) => reason);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await errorPromise;
    expect(error).toBeInstanceOf(CircuitBreakerLockProblem);
    expect(error).toMatchObject({ code: "RETRY_CIRCUIT_BREAKER_LOCK_FAILED" });
    expect(error).toHaveProperty(
      "message",
      expect.stringContaining("Circuit breaker lock contention exhausted"),
    );
    expect(error).not.toHaveProperty("message", expect.stringContaining(sensitiveCircuitId));
    expect(vi.mocked(redis.set).mock.calls.length).toBeGreaterThan(1);
    expect(vi.mocked(redis.set).mock.calls.length).toBeLessThan(100);

    releaseOwner?.();
    await ownerOperation;
    await expect(storeB.getState(sensitiveCircuitId)).resolves.toBe(CircuitState.CLOSED);
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it("concurrent success와 failure 기록은 정확한 CLOSED 상태와 count로 수렴해야 한다", async () => {
    const { redis, data } = createSharedMockRedis();
    const stateKey = "croco:cb:concurrent-recording:state";
    let releaseFailureStateRead: (() => void) | undefined;
    let failureStateReadStarted = false;
    const failureStateReadGate = new Promise<void>(
      (resolve) => (releaseFailureStateRead = resolve),
    );
    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const breakerA = new CircuitBreaker({
      circuitId: "concurrent-recording",
      failureThreshold: 2,
      stateStore: storeA,
    });
    const breakerB = new CircuitBreaker({
      circuitId: "concurrent-recording",
      failureThreshold: 2,
      stateStore: storeB,
    });
    let resolveSuccess: (() => void) | undefined;
    let rejectFailure: ((error: Error) => void) | undefined;
    const success = breakerA.execute(
      () => new Promise<string>((resolve) => (resolveSuccess = () => resolve("ok"))),
    );
    const failure = breakerB.execute(
      () => new Promise<string>((_resolve, reject) => (rejectFailure = reject)),
    );
    await vi.waitFor(() => {
      expect(resolveSuccess).toBeDefined();
      expect(rejectFailure).toBeDefined();
    });

    vi.mocked(redis.get).mockImplementation(async (key: string) => {
      if (key === stateKey && !failureStateReadStarted) {
        failureStateReadStarted = true;
        await failureStateReadGate;
      }
      return data.get(key) ?? null;
    });
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    rejectFailure?.(new Error("expected"));
    await vi.waitFor(() => expect(failureStateReadStarted).toBe(true));
    resolveSuccess?.();
    await vi.waitFor(() => expect(redis.set).toHaveBeenCalledTimes(2));

    releaseFailureStateRead?.();
    await expect(failure).rejects.toThrow("expected");
    await vi.runAllTimersAsync();
    await expect(success).resolves.toBe("ok");

    expect(vi.mocked(redis.set).mock.calls.length).toBeGreaterThan(2);
    await expect(storeA.getState("concurrent-recording")).resolves.toBe(CircuitState.CLOSED);
    await expect(storeA.getFailureCount("concurrent-recording")).resolves.toBe(0);
  });
});

describe("Redis circuit retention", () => {
  it("keeps a long-duration circuit OPEN until the HALF_OPEN boundary", async () => {
    let now = 1_700_000_000_000;
    const startedAt = now;
    const redis = createExpiringRedis(() => now);
    const store = new RedisCircuitBreakerStore({ redis });
    const breaker = new CircuitBreaker({
      circuitId: "long-open",
      failureThreshold: 1,
      openDuration: 300_000,
      now: () => now,
      stateStore: store,
    });
    const upstream = vi.fn(async (): Promise<void> => {
      throw new Error("upstream down");
    });
    await expect(breaker.execute(upstream)).rejects.toThrow("upstream down");
    now = startedAt + 120_000;
    await expect(breaker.getState()).resolves.toBe(CircuitState.OPEN);
    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    now = startedAt + 299_999;
    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(upstream).toHaveBeenCalledTimes(1);
    now = startedAt + 300_000;
    await expect(
      breaker.execute(async () => {
        expect(await breaker.getState()).toBe(CircuitState.HALF_OPEN);
        return "healthy";
      }),
    ).resolves.toBe("healthy");
    await expect(breaker.getState()).resolves.toBe(CircuitState.CLOSED);
  });

  it("keeps Retryable timeout OPEN across Redis expiry and probes at its boundary", async () => {
    let now = 1_700_000_000_000;
    const redis = createExpiringRedis(() => now);
    const store = new RedisCircuitBreakerStore({ redis });
    const upstream = vi.fn(async (): Promise<void> => {
      throw new Error("upstream down");
    });
    class Service {
      @Retryable({
        maxAttempts: 1,
        trace: false,
        now: () => now,
        circuitIdResolver: () => "retryable-long-open",
        circuitBreaker: { failureThreshold: 1, timeout: 300_000, stateStore: store },
      })
      async request(): Promise<void> {
        return upstream();
      }
    }
    const service = new Service();
    await expect(service.request()).rejects.toThrow("upstream down");
    now += 120_000;
    await expect(service.request()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(upstream).toHaveBeenCalledTimes(1);
    now += 180_000;
    upstream.mockImplementationOnce(async () => {
      expect(await store.getState("retryable-long-open")).toBe(CircuitState.HALF_OPEN);
    });
    await expect(service.request()).resolves.toBeUndefined();
    expect(upstream).toHaveBeenCalledTimes(2);
    await expect(store.getState("retryable-long-open")).resolves.toBe(CircuitState.CLOSED);
  });

  it("retains forceOpen and failed HALF_OPEN reopening for each full open duration", async () => {
    let now = 1_700_000_000_000;
    const redis = createExpiringRedis(() => now);
    const breaker = new CircuitBreaker({
      circuitId: "reopening",
      openDuration: 300_000,
      now: () => now,
      stateStore: new RedisCircuitBreakerStore({ redis }),
    });
    const upstream = vi.fn(async () => {
      expect(await breaker.getState()).toBe(CircuitState.HALF_OPEN);
      throw new Error("still down");
    });
    await breaker.forceOpen();
    now += 120_000;
    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(upstream).not.toHaveBeenCalled();
    now += 180_000;
    await expect(breaker.execute(upstream)).rejects.toThrow("still down");
    now += 299_999;
    await expect(breaker.getState()).resolves.toBe(CircuitState.OPEN);
    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(upstream).toHaveBeenCalledTimes(1);
    now += 1;
    await expect(breaker.execute(upstream)).rejects.toThrow("still down");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, {}, { minRetentionMs: 0 }])(
    "preserves the configured TTL without extra retention: %j",
    async (options) => {
      let now = 0;
      const redis = createExpiringRedis(() => now);
      const store = new RedisCircuitBreakerStore({ redis, ttlSeconds: 2 });
      await store.setLastFailureTime("legacy", now, options);
      await store.setState("legacy", CircuitState.OPEN, options);
      now = 1_999;
      await expect(store.getState("legacy")).resolves.toBe(CircuitState.OPEN);
      now = 2_000;
      await expect(store.getState("legacy")).resolves.toBe(CircuitState.CLOSED);
      await expect(store.getLastFailureTime("legacy")).resolves.toBeNull();
    },
  );

  it("rounds retention upward and adds it to every transition key's base TTL", async () => {
    let now = 0;
    const redis = createExpiringRedis(() => now);
    const store = new RedisCircuitBreakerStore({ redis, ttlSeconds: 2 });
    await store.setLastFailureTime("retained", now, { minRetentionMs: 1_001 });
    await store.setState("retained", CircuitState.OPEN, { minRetentionMs: 1_001 });
    now = 3_999;
    await expect(store.getState("retained")).resolves.toBe(CircuitState.OPEN);
    await expect(redis.get("croco:cb:retained:halfOpenActive")).resolves.toBe("0");
    await expect(redis.get("croco:cb:retained:halfOpenSuccess")).resolves.toBe("0");
    now = 4_000;
    await expect(store.getState("retained")).resolves.toBe(CircuitState.CLOSED);
    await expect(store.getLastFailureTime("retained")).resolves.toBeNull();
    await expect(redis.get("croco:cb:retained:halfOpenActive")).resolves.toBeNull();
    await expect(redis.get("croco:cb:retained:halfOpenSuccess")).resolves.toBeNull();
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "rejects invalid retention %s before Redis I/O",
    async (minRetentionMs) => {
      const { redis } = createSharedMockRedis();
      const store = new RedisCircuitBreakerStore({ redis });
      await expect(
        store.setState("invalid", CircuitState.OPEN, { minRetentionMs }),
      ).rejects.toBeInstanceOf(InvalidRetryConfigurationProblem);
      await expect(
        store.setLastFailureTime("invalid", 0, { minRetentionMs }),
      ).rejects.toBeInstanceOf(InvalidRetryConfigurationProblem);
      expect(redis.set).not.toHaveBeenCalled();
    },
  );

  it("rejects unsafe combined retention before Redis I/O", async () => {
    const { redis } = createSharedMockRedis();
    const store = new RedisCircuitBreakerStore({ redis, ttlSeconds: Number.MAX_SAFE_INTEGER });
    await expect(
      store.setState("invalid", CircuitState.OPEN, { minRetentionMs: 1 }),
    ).rejects.toBeInstanceOf(InvalidRetryConfigurationProblem);
    await expect(
      store.setLastFailureTime("invalid", 0, { minRetentionMs: 1 }),
    ).rejects.toBeInstanceOf(InvalidRetryConfigurationProblem);
    expect(redis.set).not.toHaveBeenCalled();
  });
});
