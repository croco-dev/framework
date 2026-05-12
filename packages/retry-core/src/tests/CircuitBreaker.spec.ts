import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, type CircuitBreakerOptions } from "../libs/CircuitBreaker";
import {
  type CircuitBreakerStateStore,
  CircuitState,
  InMemoryCircuitBreakerStateStore,
} from "../libs/CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "../libs/errors/CircuitBreakerOpenProblem";

describe("CircuitBreaker", () => {
  const createBreaker = (options: Partial<CircuitBreakerOptions> = {}) => {
    return new CircuitBreaker({
      circuitId: "test-circuit",
      failureThreshold: 3,
      openDuration: 100,
      halfOpenRequests: 1,
      ...options,
    });
  };

  it("초기 상태는 CLOSED여야 한다", async () => {
    const breaker = createBreaker();
    const state = await breaker.getState();
    expect(state).toBe(CircuitState.CLOSED);
  });

  it("성공 시 상태가 유지되어야 한다", async () => {
    const breaker = createBreaker();
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it("실패 임계값 도달 시 OPEN으로 전환되어야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 2 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");
    await expect(breaker.execute(fn)).rejects.toThrow("fail");

    expect(await breaker.getState()).toBe(CircuitState.OPEN);
    expect(await breaker.getFailureCount()).toBe(2);
  });

  it("OPEN 상태에서 요청이 거부되어야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    fn.mockClear();
    fn.mockResolvedValue("success");

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenProblem);
    expect(fn).not.toHaveBeenCalled();
  });

  it("OPEN 상태에서 fallback이 호출되어야 한다", async () => {
    const fallbackSpy = vi.fn().mockResolvedValue("fallback");
    const breaker = createBreaker({
      failureThreshold: 1,
      fallback: fallbackSpy,
    });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");

    const result = await breaker.execute(fn);
    expect(result).toBe("fallback");
    expect(fallbackSpy).toHaveBeenCalled();
  });

  it("openDuration 후 HALF_OPEN으로 전환되어야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 50 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");
    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    fn.mockResolvedValue("success");
    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("HALF_OPEN에서 성공 시 CLOSED로 복귀해야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 10 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");

    await new Promise((resolve) => setTimeout(resolve, 20));

    fn.mockResolvedValue("success");
    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it("HALF_OPEN에서 실패 시 OPEN으로 복귀해야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 10 });
    const fn = vi.fn();

    fn.mockRejectedValueOnce(new Error("fail"));
    await expect(breaker.execute(fn)).rejects.toThrow("fail");

    await new Promise((resolve) => setTimeout(resolve, 20));

    fn.mockRejectedValueOnce(new Error("fail again"));
    await expect(breaker.execute(fn)).rejects.toThrow("fail again");

    expect(await breaker.getState()).toBe(CircuitState.OPEN);
  });

  it("forceOpen으로 상태를 강제 설정할 수 있어야 한다", async () => {
    const breaker = createBreaker();
    const fn = vi.fn().mockResolvedValue("success");

    await breaker.forceOpen();

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenProblem);
  });

  it("forceClose로 상태를 강제 설정할 수 있어야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");
    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await breaker.forceClose();

    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it("reset으로 모든 상태를 초기화할 수 있어야 한다", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.execute(fn)).rejects.toThrow("fail");
    expect(await breaker.getState()).toBe(CircuitState.OPEN);
    expect(await breaker.getFailureCount()).toBe(1);
    expect(await breaker.getLastFailureTime()).not.toBeNull();

    await breaker.reset();

    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
    expect(await breaker.getLastFailureTime()).toBeNull();
  });

  it("상태 저장소를 교체할 수 있어야 한다", async () => {
    const customStore = new InMemoryCircuitBreakerStateStore();
    const breaker = createBreaker({ stateStore: customStore });
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("다수의 Circuit Breaker가 독립적으로 동작해야 한다", async () => {
    const breaker1 = createBreaker({ circuitId: "circuit-1", failureThreshold: 1 });
    const breaker2 = createBreaker({ circuitId: "circuit-2", failureThreshold: 1 });
    const fn1 = vi.fn().mockRejectedValue(new Error("fail1"));
    const fn2 = vi.fn().mockRejectedValue(new Error("fail2"));

    await expect(breaker1.execute(fn1)).rejects.toThrow("fail1");
    await expect(breaker2.execute(fn2)).rejects.toThrow("fail2");

    expect(await breaker1.getState()).toBe(CircuitState.OPEN);
    expect(await breaker2.getState()).toBe(CircuitState.OPEN);
  });

  describe("상태 전환 임계값 경계값", () => {
    it("실패 횟수가 정확히 threshold일 때 OPEN으로 전환되어야 한다", async () => {
      const breaker = createBreaker({ failureThreshold: 3 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(1);

      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(2);

      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.OPEN);
      expect(await breaker.getFailureCount()).toBe(3);
    });

    it("threshold-1 실패에서는 CLOSED를 유지해야 한다", async () => {
      const breaker = createBreaker({ failureThreshold: 5 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 4; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(4);
    });

    it("성공 시 failureCount가 초기화되어야 한다", async () => {
      const breaker = createBreaker({ failureThreshold: 3 });
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));
      const successFn = vi.fn().mockResolvedValue("success");

      await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      expect(await breaker.getFailureCount()).toBe(2);

      await breaker.execute(successFn);
      expect(await breaker.getFailureCount()).toBe(0);
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("동시성 버그 회귀", () => {
    it("CLOSED 상태에서 동시 요청은 직렬화되지 않고 병렬로 처리되어야 한다", async () => {
      const breaker = createBreaker({ failureThreshold: 10 });
      const fn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "ok";
      });

      const startedAt = Date.now();
      const results = await Promise.all([
        breaker.execute(fn),
        breaker.execute(fn),
        breaker.execute(fn),
        breaker.execute(fn),
        breaker.execute(fn),
      ]);
      const elapsed = Date.now() - startedAt;

      expect(results).toEqual(["ok", "ok", "ok", "ok", "ok"]);
      expect(fn).toHaveBeenCalledTimes(5);
      expect(elapsed).toBeLessThan(200);
    });

    it("BUG-12 HALF_OPEN 상태에서 동시 요청 수 제한", async () => {
      const stateStore = new InMemoryCircuitBreakerStateStore();
      const breaker = createBreaker({
        stateStore,
        halfOpenRequests: 2,
      });

      await stateStore.setState("test-circuit", CircuitState.HALF_OPEN);

      let resolveFirst!: (value: string) => void;
      let resolveSecond!: (value: string) => void;

      const firstWork = new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });
      const secondWork = new Promise<string>((resolve) => {
        resolveSecond = resolve;
      });

      const fn = vi
        .fn<() => Promise<string>>()
        .mockImplementation(async () =>
          Promise.reject(new Error("BUG-12 unexpected-third-execution")),
        )
        .mockImplementationOnce(async () => firstWork)
        .mockImplementationOnce(async () => secondWork);

      const first = breaker.execute(fn);
      const second = breaker.execute(fn);
      const third = breaker.execute(fn);

      await expect(third).rejects.toThrow(CircuitBreakerOpenProblem);
      expect(fn).toHaveBeenCalledTimes(2);

      resolveFirst("first-success");
      resolveSecond("second-success");

      await expect(first).resolves.toBe("first-success");
      await expect(second).resolves.toBe("second-success");
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("BUG-13 동시 실패 시 정확한 임계값에서 OPEN 전이", async () => {
      const breaker = createBreaker({ failureThreshold: 3 });

      let rejectFirst!: (reason?: unknown) => void;
      let rejectSecond!: (reason?: unknown) => void;
      let rejectThird!: (reason?: unknown) => void;

      const firstWork = new Promise<never>((_resolve, reject) => {
        rejectFirst = reject;
      });
      const secondWork = new Promise<never>((_resolve, reject) => {
        rejectSecond = reject;
      });
      const thirdWork = new Promise<never>((_resolve, reject) => {
        rejectThird = reject;
      });

      const fn = vi
        .fn<() => Promise<string>>()
        .mockImplementation(async () =>
          Promise.reject(new Error("BUG-13 unexpected-fourth-execution")),
        )
        .mockImplementationOnce(async () => firstWork)
        .mockImplementationOnce(async () => secondWork)
        .mockImplementationOnce(async () => thirdWork);

      const first = breaker.execute(fn);
      const second = breaker.execute(fn);
      const third = breaker.execute(fn);
      const fourth = breaker.execute(fn);

      rejectFirst(new Error("BUG-13 fail-1"));
      rejectSecond(new Error("BUG-13 fail-2"));
      rejectThird(new Error("BUG-13 fail-3"));

      await expect(first).rejects.toThrow("BUG-13 fail-1");
      await expect(second).rejects.toThrow("BUG-13 fail-2");
      await expect(third).rejects.toThrow("BUG-13 fail-3");
      await expect(fourth).rejects.toThrow(CircuitBreakerOpenProblem);

      expect(fn).toHaveBeenCalledTimes(3);
      expect(await breaker.getFailureCount()).toBe(3);
      expect(await breaker.getState()).toBe(CircuitState.OPEN);
    });

    it("BUG-88 CLOSED 슬롯 중복 해제 시에도 임계값 판정이 느슨해지지 않아야 한다", async () => {
      let currentState = CircuitState.CLOSED;
      let failureCount = 0;
      let lockCallCount = 0;

      const mockStore: CircuitBreakerStateStore = {
        getState: vi.fn().mockImplementation(async () => currentState),
        setState: vi.fn().mockImplementation(async (_id, state) => {
          currentState = state;
        }),
        getFailureCount: vi.fn().mockImplementation(async () => failureCount),
        incrementFailureCount: vi.fn().mockImplementation(async () => {
          failureCount += 1;
          return failureCount;
        }),
        resetFailureCount: vi.fn().mockImplementation(async () => {
          failureCount = 0;
        }),
        getLastFailureTime: vi.fn().mockResolvedValue(null),
        setLastFailureTime: vi.fn().mockResolvedValue(undefined),
        withCircuitLock: vi.fn().mockImplementation(async (_id, operation) => {
          lockCallCount += 1;
          const result = await operation();

          if (lockCallCount === 1) {
            await operation();
          }

          return result;
        }),
        incrementFailureAndCheck: vi.fn().mockImplementation(async (_id, threshold) => {
          failureCount += 1;
          return {
            failureCount,
            shouldOpen: failureCount >= threshold,
          };
        }),
        getHalfOpenActiveCount: vi.fn().mockResolvedValue(0),
        setHalfOpenActiveCount: vi.fn().mockResolvedValue(undefined),
        getHalfOpenSuccessCount: vi.fn().mockResolvedValue(0),
        setHalfOpenSuccessCount: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue(undefined),
      };

      const breaker = new CircuitBreaker({
        circuitId: "test-circuit",
        failureThreshold: 1,
        stateStore: mockStore,
      });

      const fn = vi.fn().mockResolvedValue("ok");

      await expect(breaker.execute(fn)).resolves.toBe("ok");

      failureCount = 1;

      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenProblem);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("halfOpen 카운터는 stateStore API를 사용해 관리해야 한다", async () => {
      let currentState = CircuitState.HALF_OPEN;
      let failureCount = 0;
      let halfOpenActiveCount = 0;
      let halfOpenSuccessCount = 0;
      let lock: Promise<void> = Promise.resolve();

      const mockStore: CircuitBreakerStateStore = {
        getState: vi.fn().mockImplementation(async () => currentState),
        setState: vi.fn().mockImplementation(async (_id, state) => {
          currentState = state;
          halfOpenActiveCount = 0;
          halfOpenSuccessCount = 0;
        }),
        getFailureCount: vi.fn().mockImplementation(async () => failureCount),
        incrementFailureCount: vi.fn().mockImplementation(async () => {
          failureCount += 1;
          return failureCount;
        }),
        resetFailureCount: vi.fn().mockImplementation(async () => {
          failureCount = 0;
        }),
        getLastFailureTime: vi.fn().mockResolvedValue(null),
        setLastFailureTime: vi.fn().mockResolvedValue(undefined),
        withCircuitLock: vi.fn().mockImplementation(async (_id, operation) => {
          const previousLock = lock;
          let releaseLock!: () => void;

          lock = new Promise<void>((resolve) => {
            releaseLock = resolve;
          });

          await previousLock;

          try {
            return await operation();
          } finally {
            releaseLock();
          }
        }),
        incrementFailureAndCheck: vi.fn().mockImplementation(async (_id, threshold) => {
          failureCount += 1;
          return {
            failureCount,
            shouldOpen: failureCount >= threshold,
          };
        }),
        getHalfOpenActiveCount: vi.fn().mockImplementation(async () => halfOpenActiveCount),
        setHalfOpenActiveCount: vi.fn().mockImplementation(async (_id, count) => {
          halfOpenActiveCount = Math.max(0, count);
        }),
        getHalfOpenSuccessCount: vi.fn().mockImplementation(async () => halfOpenSuccessCount),
        setHalfOpenSuccessCount: vi.fn().mockImplementation(async (_id, count) => {
          halfOpenSuccessCount = Math.max(0, count);
        }),
        reset: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue(undefined),
      };

      const breaker = createBreaker({
        stateStore: mockStore,
        halfOpenRequests: 1,
      });

      let resolveFirst!: (value: string) => void;
      const firstWork = new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });

      const fn = vi
        .fn<() => Promise<string>>()
        .mockImplementation(async () => Promise.reject(new Error("unexpected-second-execution")))
        .mockImplementationOnce(async () => firstWork);

      const first = breaker.execute(fn);
      const second = breaker.execute(fn);

      await expect(second).rejects.toThrow(CircuitBreakerOpenProblem);
      expect(fn).toHaveBeenCalledTimes(1);

      resolveFirst("success");
      await expect(first).resolves.toBe("success");
      expect(mockStore.setState).toHaveBeenCalledWith("test-circuit", CircuitState.CLOSED);
      expect(mockStore.resetFailureCount).toHaveBeenCalledTimes(1);
      expect(mockStore.getHalfOpenActiveCount).toHaveBeenCalled();
      expect(mockStore.setHalfOpenActiveCount).toHaveBeenCalled();
      expect(mockStore.getHalfOpenSuccessCount).toHaveBeenCalled();
      expect(mockStore.setHalfOpenSuccessCount).toHaveBeenCalled();
    });
  });

  describe("저장소 예외 처리", () => {
    it("getState 실패 시 에러를 전파해야 한다", async () => {
      const mockStore: CircuitBreakerStateStore = {
        getState: vi.fn().mockRejectedValue(new Error("Store unavailable")),
        setState: vi.fn(),
        getFailureCount: vi.fn(),
        incrementFailureCount: vi.fn(),
        resetFailureCount: vi.fn(),
        getLastFailureTime: vi.fn(),
        setLastFailureTime: vi.fn(),
        withCircuitLock: vi.fn(),
        incrementFailureAndCheck: vi.fn(),
        getHalfOpenActiveCount: vi.fn(),
        setHalfOpenActiveCount: vi.fn(),
        getHalfOpenSuccessCount: vi.fn(),
        setHalfOpenSuccessCount: vi.fn(),
        reset: vi.fn(),
        resetAll: vi.fn(),
      };

      const breaker = new CircuitBreaker({
        circuitId: "test-circuit",
        stateStore: mockStore,
      });

      await expect(breaker.getState()).rejects.toThrow("Store unavailable");
    });

    it("setState 실패 시 에러를 전파해야 한다", async () => {
      const mockStore: CircuitBreakerStateStore = {
        getState: vi.fn().mockResolvedValue(CircuitState.CLOSED),
        setState: vi.fn().mockRejectedValue(new Error("Store write failed")),
        getFailureCount: vi.fn().mockResolvedValue(0),
        incrementFailureCount: vi.fn().mockResolvedValue(1),
        resetFailureCount: vi.fn(),
        getLastFailureTime: vi.fn().mockResolvedValue(null),
        setLastFailureTime: vi.fn().mockResolvedValue(undefined),
        withCircuitLock: vi.fn().mockImplementation(async (_id, operation) => operation()),
        incrementFailureAndCheck: vi.fn().mockResolvedValue({ failureCount: 1, shouldOpen: true }),
        getHalfOpenActiveCount: vi.fn().mockResolvedValue(0),
        setHalfOpenActiveCount: vi.fn().mockResolvedValue(undefined),
        getHalfOpenSuccessCount: vi.fn().mockResolvedValue(0),
        setHalfOpenSuccessCount: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue(undefined),
      };

      const breaker = new CircuitBreaker({
        circuitId: "test-circuit",
        failureThreshold: 1,
        stateStore: mockStore,
      });

      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(breaker.execute(fn)).rejects.toThrow("Store write failed");
    });
  });

  describe("시간 기반 상태 전환 (fake timers)", () => {
    it("openDuration 경과 후 HALF_OPEN으로 전환되어야 한다", async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 1, openDuration: 100 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(100);

      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      fn.mockResolvedValue("success");
      const result = await breaker.execute(fn);

      expect(result).toBe("success");
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });

    it("openDuration 미만에서는 OPEN을 유지해야 한다", async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 1, openDuration: 100 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(50);

      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });

    it("HALF_OPEN에서 성공 후 CLOSED로 전환되고 실패 카운트가 초기화되어야 한다", async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 2, openDuration: 50 });
      const fn = vi.fn();

      fn.mockRejectedValueOnce(new Error("fail"));
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getFailureCount()).toBe(1);

      fn.mockRejectedValueOnce(new Error("fail"));
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(await breaker.getState()).toBe(CircuitState.OPEN);
      expect(await breaker.getFailureCount()).toBe(2);

      vi.advanceTimersByTime(60);

      fn.mockResolvedValue("success");
      await breaker.execute(fn);

      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(0);

      vi.useRealTimers();
    });
  });
});
