import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";

import { CircuitBreaker } from "../libs/CircuitBreaker";
import { CircuitState } from "../libs/CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "../libs/errors/CircuitBreakerOpenProblem";
import { CircuitBreakerLockProblem } from "../libs/errors/RetryInfrastructureProblem";
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
