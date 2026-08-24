import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { NoBackoff } from "../libs/BackoffPolicy";
import { CircuitBreaker } from "../libs/CircuitBreaker";
import { InMemoryCircuitBreakerStateStore } from "../libs/CircuitBreakerState";
import {
  CircuitBreakerOpenProblem,
  DuplicateRecoverHandlerProblem,
  RetryAbortedProblem,
  RetryExhaustedProblem,
} from "../libs/errors";
import { runWithLambdaContext } from "../libs/LambdaTimeoutGuard";
import { Recover } from "../libs/Recover";
import { Retryable } from "../libs/Retryable";
import type { RetryPolicy } from "../libs/RetryPolicy";

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("@Retryable", () => {
  it("retries method and succeeds", async () => {
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      })
      async doWork(): Promise<string> {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "success";
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("forwards caller cancellation to the retry engine", async () => {
    const controller = new AbortController();
    controller.abort();
    const callback = vi.fn();

    class TestService {
      @Retryable({ signal: controller.signal })
      async doWork(): Promise<string> {
        callback();
        return "success";
      }
    }

    await expect(new TestService().doWork()).rejects.toThrow(RetryAbortedProblem);
    expect(callback).not.toHaveBeenCalled();
  });

  it("resolves cancellation independently for each invocation", async () => {
    const abortedController = new AbortController();
    const activeController = new AbortController();
    abortedController.abort();

    class TestService {
      attempts = 0;

      @Retryable({ signalResolver: ({ args }) => args[0] as AbortSignal })
      async doWork(_signal: AbortSignal): Promise<string> {
        this.attempts++;
        return "success";
      }
    }

    const service = new TestService();

    await expect(service.doWork(abortedController.signal)).rejects.toThrow(RetryAbortedProblem);
    await expect(service.doWork(activeController.signal)).resolves.toBe("success");
    expect(service.attempts).toBe(1);
  });

  it("preserves this context", async () => {
    class TestService {
      private value = "hello";

      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      })
      async getValue(): Promise<string> {
        return this.value;
      }
    }

    const service = new TestService();
    const result = await service.getValue();

    expect(result).toBe("hello");
  });

  it("calls recover method on exhaustion", async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
        recover: "handleError",
      })
      async doWork(): Promise<string> {
        throw new Error("always fails");
      }

      async handleError(error: Error, ..._args: unknown[]): Promise<string> {
        return `recovered: ${error.message}`;
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe("recovered: always fails");
  });

  it("passes arguments to original method", async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      })
      async add(a: number, b: number): Promise<number> {
        return a + b;
      }
    }

    const service = new TestService();
    const result = await service.add(2, 3);

    expect(result).toBe(5);
  });

  it("throws original non-retryable error when it occurs on last attempt", async () => {
    class RetryableError extends Error {}
    class NonRetryableError extends Error {}

    const nonRetryableError = new NonRetryableError("non-retryable on last attempt");
    const retryPolicy: RetryPolicy = {
      shouldRetry(error: unknown): boolean {
        return error instanceof RetryableError;
      },
    };

    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        wrapExhausted: true,
        backoffPolicy: new NoBackoff(),
        retryPolicy,
      })
      async doWork(): Promise<void> {
        attempts++;

        if (attempts < 3) {
          throw new RetryableError("retryable");
        }

        throw nonRetryableError;
      }
    }

    const service = new TestService();

    await expect(service.doWork()).rejects.toBe(nonRetryableError);
    expect(attempts).toBe(3);
  });

  it("wraps exhausted error in RetryExhaustedProblem when wrapExhausted is true", async () => {
    const originalError = new Error("fail");

    class TestService {
      @Retryable({ maxAttempts: 2, backoffPolicy: new NoBackoff(), wrapExhausted: true })
      async doWork(): Promise<void> {
        throw originalError;
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toBeInstanceOf(RetryExhaustedProblem);
  });

  it("throws original error when wrapExhausted is false (default)", async () => {
    const originalError = new Error("original");

    class TestService {
      @Retryable({ maxAttempts: 2, backoffPolicy: new NoBackoff() })
      async doWork(): Promise<void> {
        throw originalError;
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toBe(originalError);
  });

  it("calls listener onError and onSuccess correctly", async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();
    const errorAttempts: number[] = [];
    const successAttempts: number[] = [];
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [
          {
            onError: (context, error) => {
              errorAttempts.push(context.attempt);
              onError(context, error);
            },
            onSuccess: (context) => {
              successAttempts.push(context.attempt);
              onSuccess(context);
            },
          },
        ],
      })
      async doWork(): Promise<string> {
        attempts++;
        if (attempts < 3) {
          throw new Error(`fail-${attempts}`);
        }

        return "success";
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe("success");
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(errorAttempts).toEqual([1, 2]);
    expect(successAttempts).toEqual([3]);
  });

  it("calls listener onExhausted when retries are exhausted", async () => {
    const onExhausted = vi.fn();

    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
        listeners: [
          {
            onExhausted,
          },
        ],
      })
      async doWork(): Promise<void> {
        throw new Error("always fail");
      }
    }

    const service = new TestService();

    await expect(service.doWork()).rejects.toThrow("always fail");
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("creates circuit breaker and throws CircuitBreakerOpenProblem when threshold exceeded", async () => {
    const getStateSpy = vi.spyOn(InMemoryCircuitBreakerStateStore.prototype, "getState");
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          successThreshold: 1,
          timeout: 1000,
        },
      })
      async doWork(): Promise<void> {
        attempts++;
        throw new Error("fail");
      }
    }

    const service = new TestService();

    try {
      await expect(service.doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
      expect(attempts).toBe(1);
      expect(getStateSpy).toHaveBeenCalled();
    } finally {
      getStateSpy.mockRestore();
    }
  });

  it("keeps open state for the default circuit id across sequential calls", async () => {
    const attempts: string[] = [];

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          successThreshold: 1,
          timeout: 1000,
        },
      })
      async doWork(tenantId: string): Promise<void> {
        attempts.push(tenantId);
        throw new Error(`fail:${tenantId}`);
      }
    }

    const service = new TestService();

    await expect(service.doWork("tenant-a")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    await expect(service.doWork("tenant-b")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);

    expect(attempts).toEqual(["tenant-a"]);
  });

  it("allows custom circuit ids to isolate circuit breaker state", async () => {
    const attempts: string[] = [];

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          successThreshold: 1,
          timeout: 1000,
        },
        circuitIdResolver: ({ args, defaultCircuitId }) => `${defaultCircuitId}:${String(args[0])}`,
      })
      async doWork(tenantId: string): Promise<void> {
        attempts.push(tenantId);
        throw new Error(`fail:${tenantId}`);
      }
    }

    const service = new TestService();

    await expect(service.doWork("tenant-a")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    await expect(service.doWork("tenant-b")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    await expect(service.doWork("tenant-a")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);

    expect(attempts).toEqual(["tenant-a", "tenant-b"]);
  });

  it("shares circuit state across service instances", async () => {
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 1,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          timeout: 1000,
        },
      })
      async doWork(): Promise<void> {
        attempts++;
        throw new Error("fail");
      }
    }

    await expect(new TestService().doWork()).rejects.toThrow("fail");
    await expect(new TestService().doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);

    expect(attempts).toBe(1);
  });

  it("keeps open duration and half-open success state across calls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      let attempts = 0;
      let shouldFail = true;

      class TestService {
        @Retryable({
          maxAttempts: 1,
          backoffPolicy: new NoBackoff(),
          circuitBreaker: {
            failureThreshold: 1,
            successThreshold: 2,
            timeout: 1000,
          },
        })
        async doWork(): Promise<string> {
          attempts++;
          if (shouldFail) {
            throw new Error("fail");
          }

          return "success";
        }
      }

      const service = new TestService();
      await expect(service.doWork()).rejects.toThrow("fail");

      shouldFail = false;
      await expect(service.doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
      expect(attempts).toBe(1);

      vi.advanceTimersByTime(1000);

      await expect(service.doWork()).resolves.toBe("success");
      await expect(service.doWork()).resolves.toBe("success");
      await expect(service.doWork()).resolves.toBe("success");
      expect(attempts).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves half-open recovery on the first call after a long open duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const openDuration = 10 * 60 * 1000;
      let attempts = 0;
      let shouldFail = true;

      class TestService {
        @Retryable({
          maxAttempts: 1,
          backoffPolicy: new NoBackoff(),
          circuitBreaker: {
            failureThreshold: 3,
            successThreshold: 2,
            timeout: openDuration,
          },
        })
        async doWork(): Promise<void> {
          attempts++;
          if (shouldFail) {
            throw new Error("fail");
          }
        }
      }

      const service = new TestService();
      await expect(service.doWork()).rejects.toThrow("fail");
      await expect(service.doWork()).rejects.toThrow("fail");
      await expect(service.doWork()).rejects.toThrow("fail");

      vi.advanceTimersByTime(openDuration + 1);
      shouldFail = false;
      await expect(service.doWork()).resolves.toBeUndefined();

      shouldFail = true;
      await expect(service.doWork()).rejects.toThrow("fail");
      await expect(service.doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
      expect(attempts).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reopens after a failed half-open probe across calls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      let attempts = 0;

      class TestService {
        @Retryable({
          maxAttempts: 1,
          backoffPolicy: new NoBackoff(),
          circuitBreaker: {
            failureThreshold: 1,
            timeout: 1000,
          },
        })
        async doWork(): Promise<void> {
          attempts++;
          throw new Error("fail");
        }
      }

      const service = new TestService();
      await expect(service.doWork()).rejects.toThrow("fail");
      vi.advanceTimersByTime(1000);
      await expect(service.doWork()).rejects.toThrow("fail");
      await expect(service.doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
      expect(attempts).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("admits same-id healthy concurrent decorated calls beyond the failure threshold", async () => {
    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const entered: number[] = [];

    class TestService {
      @Retryable({
        maxAttempts: 1,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 2,
          timeout: 1000,
        },
      })
      async doWork(call: number): Promise<void> {
        entered.push(call);
        if (call === 1) {
          return first.promise;
        }
        if (call === 2) {
          return second.promise;
        }
      }
    }

    const service = new TestService();
    const firstCall = service.doWork(1);
    const secondCall = service.doWork(2);

    await vi.waitFor(() => expect(entered).toEqual([1, 2]));
    await expect(service.doWork(3)).resolves.toBeUndefined();
    expect(entered).toEqual([1, 2, 3]);

    first.resolve();
    second.resolve();
    await expect(firstCall).resolves.toBeUndefined();
    await expect(secondCall).resolves.toBeUndefined();
    await expect(service.doWork(4)).resolves.toBeUndefined();
    expect(entered).toEqual([1, 2, 3, 4]);
  });

  it("uses a supplied state store without resetting it during registry churn", async () => {
    const stateStore = new InMemoryCircuitBreakerStateStore({
      idleTtlMs: 0,
      maxEntries: 2000,
    });
    const resetSpy = vi.spyOn(stateStore, "reset");
    const attempts: string[] = [];

    class TestService {
      @Retryable({
        maxAttempts: 1,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          stateStore,
          timeout: 60_000,
        },
        circuitIdResolver: ({ args }) => String(args[0]),
      })
      async doWork(circuitId: string): Promise<void> {
        attempts.push(circuitId);
        throw new Error(`fail:${circuitId}`);
      }
    }

    const service = new TestService();
    for (let index = 0; index <= 1000; index++) {
      await expect(service.doWork(`circuit-${index}`)).rejects.toThrow(`fail:circuit-${index}`);
    }

    await expect(service.doWork("circuit-0")).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
    expect(attempts.filter((circuitId) => circuitId === "circuit-0")).toHaveLength(1);
    expect(resetSpy).not.toHaveBeenCalled();
  }, 15_000);

  it("releases registry activity when synchronous invocation setup fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const stateStore = new InMemoryCircuitBreakerStateStore({
      idleTtlMs: 0,
      maxEntries: 2000,
    });
    const resetSpy = vi.spyOn(stateStore, "reset");
    const executeSpy = vi.spyOn(CircuitBreaker.prototype, "execute");

    try {
      class TestService {
        @Retryable({
          maxAttempts: 1,
          backoffPolicy: new NoBackoff(),
          circuitBreaker: {
            failureThreshold: 2,
            stateStore,
            timeout: 1000,
          },
          circuitIdResolver: ({ args }) => String(args[0]),
        })
        async doWork(_circuitId: string): Promise<void> {}
      }

      const service = new TestService();
      const setupFailureReceiver = new Proxy(service, {
        getPrototypeOf: () => {
          throw new Error("prototype unavailable");
        },
      });

      await expect(Reflect.apply(service.doWork, setupFailureReceiver, ["failed"])).rejects.toThrow(
        "prototype unavailable",
      );

      for (let index = 0; index < 1000; index++) {
        vi.setSystemTime(index + 1);
        await expect(service.doWork(`normal-${index}`)).resolves.toBeUndefined();
      }

      const firstNormalBreaker = executeSpy.mock.contexts[0];
      vi.setSystemTime(2000);
      await expect(service.doWork("normal-0")).resolves.toBeUndefined();

      expect(executeSpy.mock.contexts[1000]).toBe(firstNormalBreaker);
      expect(resetSpy).not.toHaveBeenCalled();
    } finally {
      executeSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("retains exactly one thousand inactive registry entries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const stateStore = new InMemoryCircuitBreakerStateStore({
      idleTtlMs: 0,
      maxEntries: 2000,
    });
    const resetSpy = vi.spyOn(stateStore, "reset");
    const executeSpy = vi.spyOn(CircuitBreaker.prototype, "execute");

    try {
      class TestService {
        @Retryable({
          maxAttempts: 1,
          backoffPolicy: new NoBackoff(),
          circuitBreaker: {
            failureThreshold: 2,
            stateStore,
            timeout: 1000,
          },
          circuitIdResolver: ({ args }) => String(args[0]),
        })
        async doWork(_circuitId: string): Promise<void> {}
      }

      const service = new TestService();
      for (let index = 0; index < 1000; index++) {
        vi.setSystemTime(index + 1);
        await expect(service.doWork(`circuit-${index}`)).resolves.toBeUndefined();
      }

      const firstBreaker = executeSpy.mock.contexts[0];
      const secondBreaker = executeSpy.mock.contexts[1];

      vi.setSystemTime(2000);
      await expect(service.doWork("circuit-0")).resolves.toBeUndefined();
      expect(executeSpy.mock.contexts[1000]).toBe(firstBreaker);

      vi.setSystemTime(2001);
      await expect(service.doWork("circuit-1000")).resolves.toBeUndefined();
      vi.setSystemTime(2002);
      await expect(service.doWork("circuit-1")).resolves.toBeUndefined();

      expect(executeSpy.mock.contexts[1002]).not.toBe(secondBreaker);
      expect(resetSpy).not.toHaveBeenCalled();
    } finally {
      executeSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("keeps later healthy calls admissible when failure bookkeeping cannot acquire the store lock", async () => {
    class RejectFirstLockStore extends InMemoryCircuitBreakerStateStore {
      private shouldReject = true;

      override async withCircuitLock<T>(
        circuitId: string,
        operation: () => Promise<T>,
      ): Promise<T> {
        if (this.shouldReject) {
          this.shouldReject = false;
          throw new Error("lock unavailable");
        }

        return super.withCircuitLock(circuitId, operation);
      }
    }

    const first = createDeferred<void>();
    const third = createDeferred<void>();
    const entered: number[] = [];

    class TestService {
      @Retryable({
        maxAttempts: 1,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 2,
          stateStore: new RejectFirstLockStore(),
          timeout: 1000,
        },
      })
      async doWork(call: number): Promise<void> {
        entered.push(call);
        if (call === 1) {
          return first.promise;
        }
        if (call === 2) {
          throw new Error("dependency failed");
        }
        if (call === 3) {
          return third.promise;
        }
      }
    }

    const service = new TestService();
    const firstCall = service.doWork(1);
    await vi.waitFor(() => expect(entered).toEqual([1]));

    await expect(service.doWork(2)).rejects.toThrow("lock unavailable");

    const thirdCall = service.doWork(3);
    await vi.waitFor(() => expect(entered).toEqual([1, 2, 3]));
    await expect(service.doWork(4)).resolves.toBeUndefined();
    expect(entered).toEqual([1, 2, 3, 4]);

    first.resolve();
    third.resolve();
    await expect(firstCall).resolves.toBeUndefined();
    await expect(thirdCall).resolves.toBeUndefined();
  });

  it("calls recover only when error matches recover type", async () => {
    class SpecificError extends Error {
      constructor(..._args: unknown[]) {
        super("specific");
      }
    }

    class OtherError extends Error {
      constructor(..._args: unknown[]) {
        super("other");
      }
    }

    class TestService {
      @Retryable({ maxAttempts: 1, backoffPolicy: new NoBackoff() })
      async doWork(useSpecific: boolean): Promise<string> {
        throw useSpecific ? new SpecificError("specific") : new OtherError("other");
      }

      @Recover(SpecificError)
      async handleSpecific(_error: SpecificError): Promise<string> {
        return "recovered";
      }
    }

    const service = new TestService();

    await expect(service.doWork(true)).resolves.toBe("recovered");
    await expect(service.doWork(false)).rejects.toBeInstanceOf(OtherError);
  });

  it("fails fast when duplicate typed recover handlers are registered", () => {
    class SpecificError extends Error {
      constructor(..._args: unknown[]) {
        super("specific");
      }
    }

    expect(() => {
      class TestService {
        @Recover(SpecificError)
        async handleFirst(_error: SpecificError): Promise<string> {
          return "first";
        }

        @Recover(SpecificError)
        async handleSecond(_error: SpecificError): Promise<string> {
          return "second";
        }
      }

      return TestService;
    }).toThrow(DuplicateRecoverHandlerProblem);
  });

  it("fails fast when duplicate catch-all recover handlers are registered", () => {
    expect(() => {
      class TestService {
        @Recover()
        async handleFirst(_error: Error): Promise<string> {
          return "first";
        }

        @Recover()
        async handleSecond(_error: Error): Promise<string> {
          return "second";
        }
      }

      return TestService;
    }).toThrow(DuplicateRecoverHandlerProblem);
  });

  it("uses lambdaTimeoutReserveMs when lambda context provided", async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoff: { delay: 20, multiplier: 1, jitter: false },
        lambdaTimeoutReserveMs: 50,
      })
      async doWork(): Promise<void> {
        throw new Error("fail");
      }
    }

    const service = new TestService();
    await runWithLambdaContext(
      {
        getRemainingTimeInMillis: () => 60,
      },
      async () => {
        await expect(service.doWork()).rejects.toThrow("Lambda timeout guard");
      },
    );
  });
});
