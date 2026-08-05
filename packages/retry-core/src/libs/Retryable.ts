import { recordEvent, withSpan } from "@croco/telemetry-api";
import type { BackoffOptions, BackoffPolicy } from "./BackoffPolicy";
import { CircuitBreaker } from "./CircuitBreaker";
import {
  type CircuitBreakerStateStore,
  CircuitState,
  InMemoryCircuitBreakerStateStore,
} from "./CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "./errors/CircuitBreakerOpenProblem";
import { RetryExhaustedProblem } from "./errors/RetryExhaustedProblem";
import { LambdaTimeoutGuard } from "./LambdaTimeoutGuard";
import { assertValidRetryNumber } from "./numericValidation";
import { findRecoverMethod, getRecoverMethods } from "./Recover";
import type { RetryContext } from "./RetryContext";
import type { RetryListener } from "./RetryListener";
import { RetryOrchestrator } from "./RetryOrchestrator";
import type { RetryPolicy, RetryPolicyOptions } from "./RetryPolicy";

/**
 * CircuitBreaker 설정 옵션.
 */
export interface CircuitBreakerConfig {
  /** 실패 임계값 - 양의 안전 정수이며, 이 횟수 이상 실패하면 OPEN 상태로 전환 */
  failureThreshold: number;

  /** 양의 안전 정수 성공 임계값 (HALF_OPEN 상태에서 이 횟수 성공하면 CLOSED로 복귀) */
  successThreshold?: number;

  /** OPEN 상태 유지 시간 (1 이상 2,147,483,647 이하의 정수 밀리초) */
  timeout?: number;

  /** 상태 공유 범위를 제어하는 저장소 (기본값: decorated method별 in-memory store) */
  stateStore?: CircuitBreakerStateStore;
}

type CircuitBreakerRegistryEntry = {
  activeCalls: number;
  breaker: CircuitBreaker;
  lastAccessedAt: number;
};

const RETRYABLE_CIRCUIT_REGISTRY_MAX_ENTRIES = 1000;
const RETRYABLE_CIRCUIT_REGISTRY_IDLE_TTL_MS = 5 * 60 * 1000;

function resolveDefaultStateStoreIdleTtl(timeout: number | undefined): number {
  if (timeout === undefined || !Number.isFinite(timeout) || timeout <= 0) {
    return RETRYABLE_CIRCUIT_REGISTRY_IDLE_TTL_MS;
  }

  const extendedTtl = timeout + RETRYABLE_CIRCUIT_REGISTRY_IDLE_TTL_MS;
  return Number.isFinite(extendedTtl) ? extendedTtl : Number.POSITIVE_INFINITY;
}

class RetryableCircuitBreakerRegistry {
  private readonly entries = new Map<string, CircuitBreakerRegistryEntry>();
  private readonly stateStore: CircuitBreakerStateStore;

  constructor(private readonly config: CircuitBreakerConfig) {
    this.stateStore =
      config.stateStore ??
      new InMemoryCircuitBreakerStateStore({
        idleTtlMs: resolveDefaultStateStoreIdleTtl(config.timeout),
      });
  }

  acquire(circuitId: string): CircuitBreakerRegistryEntry {
    const now = Date.now();
    this.prune(now);

    let entry = this.entries.get(circuitId);
    if (!entry) {
      this.makeRoomForNewEntry();
      entry = {
        activeCalls: 0,
        breaker: new CircuitBreaker({
          circuitId,
          failureThreshold: this.config.failureThreshold,
          stateStore: this.stateStore,
          ...(this.config.timeout === undefined ? {} : { openDuration: this.config.timeout }),
          ...(this.config.successThreshold === undefined
            ? {}
            : { halfOpenRequests: this.config.successThreshold }),
        }),
        lastAccessedAt: now,
      };
      this.entries.set(circuitId, entry);
    }

    entry.activeCalls += 1;
    entry.lastAccessedAt = now;
    return entry;
  }

  release(entry: CircuitBreakerRegistryEntry): void {
    entry.activeCalls = Math.max(0, entry.activeCalls - 1);
    entry.lastAccessedAt = Date.now();
    this.prune(entry.lastAccessedAt);
    this.trimOverflow();
  }

  private prune(now: number): void {
    for (const [circuitId, entry] of this.entries) {
      if (
        entry.activeCalls === 0 &&
        now - entry.lastAccessedAt > RETRYABLE_CIRCUIT_REGISTRY_IDLE_TTL_MS
      ) {
        this.entries.delete(circuitId);
      }
    }
  }

  private makeRoomForNewEntry(): void {
    while (this.entries.size >= RETRYABLE_CIRCUIT_REGISTRY_MAX_ENTRIES) {
      if (!this.evictOldestInactiveEntry()) {
        return;
      }
    }
  }

  private trimOverflow(): void {
    while (this.entries.size > RETRYABLE_CIRCUIT_REGISTRY_MAX_ENTRIES) {
      if (!this.evictOldestInactiveEntry()) {
        return;
      }
    }
  }

  private evictOldestInactiveEntry(): boolean {
    const oldestInactive = this.findOldestInactiveEntry();
    if (!oldestInactive) {
      return false;
    }

    this.entries.delete(oldestInactive);
    return true;
  }

  private findOldestInactiveEntry(): string | null {
    let oldest: { circuitId: string; lastAccessedAt: number } | null = null;

    for (const [circuitId, entry] of this.entries) {
      if (entry.activeCalls > 0 || (oldest && oldest.lastAccessedAt <= entry.lastAccessedAt)) {
        continue;
      }

      oldest = { circuitId, lastAccessedAt: entry.lastAccessedAt };
    }

    return oldest?.circuitId ?? null;
  }
}

/**
 * Options for @Retryable decorator.
 */
export interface RetryableOptions extends RetryPolicyOptions {
  /** Backoff configuration */
  backoff?: BackoffOptions;

  /** Custom retry policy */
  retryPolicy?: RetryPolicy;

  /** Custom backoff policy. When provided, it overrides and bypasses validation of `backoff`. */
  backoffPolicy?: BackoffPolicy;

  /** Wrap exhausted error instead of re-throwing last error */
  wrapExhausted?: boolean;

  /** Recovery method name on the same class */
  recover?: string;

  /** Disable telemetry (default: true) */
  trace?: boolean;

  /** Custom retry listeners */
  listeners?: RetryListener[];

  /** Caller cancellation signal */
  signal?: AbortSignal;

  /** Resolve a caller cancellation signal for each invocation */
  signalResolver?: (context: RetrySignalResolverContext) => AbortSignal | undefined;

  /** CircuitBreaker options */
  circuitBreaker?: CircuitBreakerConfig;

  /** Custom circuit ID resolver */
  circuitIdResolver?: (context: CircuitIdResolverContext) => string;

  /** Non-negative integer Lambda reserve time up to 2,147,483,647ms. */
  lambdaTimeoutReserveMs?: number;
}

export type CircuitIdResolverContext = {
  args: unknown[];
  instance: unknown;
  methodName: string;
  targetName: string;
  defaultCircuitId: string;
};

export type RetrySignalResolverContext = {
  args: unknown[];
  instance: unknown;
  methodName: string;
  targetName: string;
};

/**
 * Retry decorator for methods.
 *
 * @example
 * ```typescript
 * class Service {
 *   @Retryable({ maxAttempts: 3, backoff: { delay: 1000 } })
 *   async fetchData(): Promise<Data> {
 *     return await this.api.get('/data');
 *   }
 * }
 * ```
 */
export function Retryable(options: RetryableOptions = {}): MethodDecorator {
  const maxAttempts = options.maxAttempts ?? 3;
  assertValidRetryNumber("maxAttempts", maxAttempts, "positive-safe-integer");

  if (!options.backoffPolicy) {
    if (options.backoff?.delay !== undefined) {
      assertValidRetryNumber("backoff.delay", options.backoff.delay, "non-negative-timer-integer");
    }
    if (options.backoff?.multiplier !== undefined) {
      assertValidRetryNumber(
        "backoff.multiplier",
        options.backoff.multiplier,
        "finite-positive-number",
      );
    }
    if (options.backoff?.maxDelay !== undefined) {
      assertValidRetryNumber(
        "backoff.maxDelay",
        options.backoff.maxDelay,
        "positive-timer-integer",
      );
    }
  }

  if (options.circuitBreaker) {
    assertValidRetryNumber(
      "circuitBreaker.failureThreshold",
      options.circuitBreaker.failureThreshold,
      "positive-safe-integer",
    );
    if (options.circuitBreaker.successThreshold !== undefined) {
      assertValidRetryNumber(
        "circuitBreaker.successThreshold",
        options.circuitBreaker.successThreshold,
        "positive-safe-integer",
      );
    }
    if (options.circuitBreaker.timeout !== undefined) {
      assertValidRetryNumber(
        "circuitBreaker.timeout",
        options.circuitBreaker.timeout,
        "positive-timer-integer",
      );
    }
  }

  if (options.lambdaTimeoutReserveMs !== undefined) {
    assertValidRetryNumber(
      "lambdaTimeoutReserveMs",
      options.lambdaTimeoutReserveMs,
      "non-negative-timer-integer",
    );
  }

  const wrapExhausted = options.wrapExhausted ?? false;
  const trace = options.trace ?? true;

  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const targetName =
      (_target as { constructor?: { name?: string } }).constructor?.name ?? "UnknownTarget";
    const defaultCircuitId = `${targetName}.${methodName}`;
    const circuitBreakerRegistry = options.circuitBreaker
      ? new RetryableCircuitBreakerRegistry(options.circuitBreaker)
      : undefined;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const signal =
        options.signalResolver?.({ args, instance: this, methodName, targetName }) ??
        options.signal;
      const circuitId =
        options.circuitIdResolver?.({
          args,
          instance: this,
          methodName,
          targetName,
          defaultCircuitId,
        }) ?? defaultCircuitId;

      const circuitBreakerEntry = circuitBreakerRegistry?.acquire(circuitId);
      try {
        const circuitBreaker = circuitBreakerEntry?.breaker;
        const timeoutGuard =
          options.lambdaTimeoutReserveMs !== undefined
            ? new LambdaTimeoutGuard({ reserveTimeMs: options.lambdaTimeoutReserveMs })
            : undefined;
        const prototype = Object.getPrototypeOf(this);
        const hasRecover = options.recover !== undefined || getRecoverMethods(prototype).length > 0;

        const callback = circuitBreaker
          ? async (): Promise<unknown> =>
              await circuitBreaker.execute(async () => await originalMethod.apply(this, args))
          : async (): Promise<unknown> => await originalMethod.apply(this, args);

        const additionalHooks = {
          onStart: async (context: RetryContext): Promise<boolean> => {
            if (trace) {
              context.setAttribute("telemetry.span_name", `retry:${methodName}`);
            }

            return true;
          },
          onRetryError: async (error: Error, context: RetryContext): Promise<void> => {
            if (!trace) {
              return;
            }

            recordEvent("retry.attempt_failed", {
              "retry.attempt": context.attempt,
              "retry.method_name": methodName,
              "retry.error_type": error.name,
              "retry.error_message": error.message,
              "retry.will_retry": context.attempt < maxAttempts,
            });
          },
          onSuccess: async (context: RetryContext): Promise<void> => {
            if (!trace) {
              return;
            }

            recordEvent("retry.success", {
              "retry.attempt": context.attempt,
              "retry.method_name": methodName,
            });
          },
          onExhausted: async (_error: Error, context: RetryContext): Promise<void> => {
            if (!trace) {
              return;
            }

            recordEvent("retry.exhausted", {
              "retry.max_attempts": maxAttempts,
              "retry.method_name": methodName,
              "retry.final_error": context.lastError?.name,
            });
          },
          beforeWait: async (delay: number): Promise<boolean> => {
            if (circuitBreaker) {
              const circuitState = await circuitBreaker.getState();
              if (circuitState === CircuitState.OPEN) {
                throw new CircuitBreakerOpenProblem(circuitId);
              }
            }

            if (timeoutGuard) {
              timeoutGuard.checkTimeout(delay);
            }

            return true;
          },
        };

        const recovery = hasRecover
          ? async (context: RetryContext): Promise<unknown> => {
              const fallbackError = new RetryExhaustedProblem(
                `Retry exhausted after ${maxAttempts} attempts for '${methodName}'`,
                null,
                maxAttempts,
                methodName,
              );
              const lastError = context.lastError ?? fallbackError;
              const recoverableError = context.lastError ?? fallbackError.getOriginalError();

              const recoverMeta = findRecoverMethod(prototype, recoverableError);
              if (recoverMeta) {
                const recoverMethod = (this as Record<string, unknown>)[recoverMeta.methodName];
                if (typeof recoverMethod === "function") {
                  return await recoverMethod.call(this, recoverableError, ...args);
                }
              }

              if (options.recover) {
                const recoverMethod = (this as Record<string, unknown>)[options.recover];
                if (typeof recoverMethod === "function") {
                  return await recoverMethod.call(this, recoverableError, ...args);
                }
              }

              if (wrapExhausted) {
                throw RetryExhaustedProblem.fromContext(methodName, maxAttempts, context.lastError);
              }

              throw lastError;
            }
          : undefined;

        const executeWithRetry = async (): Promise<unknown> =>
          await RetryOrchestrator.execute(
            methodName,
            args,
            callback,
            { ...options, maxAttempts, wrapExhausted, signal },
            additionalHooks,
            recovery,
          );

        if (!trace) {
          return await executeWithRetry();
        }

        const retryPolicyName = options.retryPolicy?.constructor.name ?? "DefaultRetryPolicy";

        return await withSpan(
          async (span) => {
            // Set span attributes
            span.setAttribute("retry.max_attempts", maxAttempts);
            span.setAttribute("retry.method_name", methodName);
            span.setAttribute("retry.policy", retryPolicyName);

            return await executeWithRetry();
          },
          {
            name: `retry:${methodName}`,
            attributes: {
              "retry.max_attempts": maxAttempts,
              "retry.method_name": methodName,
            },
          },
        );
      } finally {
        if (circuitBreakerEntry) {
          circuitBreakerRegistry?.release(circuitBreakerEntry);
        }
      }
    };

    return descriptor;
  };
}
