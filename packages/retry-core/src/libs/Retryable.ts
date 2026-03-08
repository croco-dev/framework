import { recordEvent, withSpan } from '@croco/telemetry-api';
import type { BackoffOptions, BackoffPolicy } from './BackoffPolicy';
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitState } from './CircuitBreakerState';
import { CircuitBreakerOpenProblem } from './errors/CircuitBreakerOpenProblem';
import { RetryExhaustedProblem } from './errors/RetryExhaustedProblem';
import { LambdaTimeoutGuard } from './LambdaTimeoutGuard';
import { findRecoverMethod, getRecoverMethods } from './Recover';
import type { RetryContext } from './RetryContext';
import type { RetryListener } from './RetryListener';
import { RetryOrchestrator } from './RetryOrchestrator';
import type { RetryPolicy, RetryPolicyOptions } from './RetryPolicy';

/**
 * Options for @Retryable decorator.
 */
export interface RetryableOptions extends RetryPolicyOptions {
  /** Backoff configuration */
  backoff?: BackoffOptions;

  /** Custom retry policy */
  retryPolicy?: RetryPolicy;

  /** Custom backoff policy */
  backoffPolicy?: BackoffPolicy;

  /** Wrap exhausted error instead of re-throwing last error */
  wrapExhausted?: boolean;

  /** Recovery method name on the same class */
  recover?: string;

  /** Disable telemetry (default: true) */
  trace?: boolean;

  /** Custom retry listeners */
  listeners?: RetryListener[];

  /** CircuitBreaker options */
  circuitBreaker?: {
    failureThreshold: number;
    successThreshold?: number;
    timeout?: number;
    halfOpenAttempts?: number;
  };

  circuitIdResolver?: (context: CircuitIdResolverContext) => string;

  /** Reserve time for Lambda timeout (ms) */
  lambdaTimeoutReserveMs?: number;
}

export type CircuitIdResolverContext = {
  args: unknown[];
  instance: unknown;
  methodName: string;
  targetName: string;
  defaultCircuitId: string;
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
  const wrapExhausted = options.wrapExhausted ?? false;
  const trace = options.trace ?? true;

  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const targetName = (_target as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownTarget';
    const defaultCircuitId = `${targetName}.${methodName}`;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const circuitId =
        options.circuitIdResolver?.({
          args,
          instance: this,
          methodName,
          targetName,
          defaultCircuitId,
        }) ?? defaultCircuitId;

      const halfOpenRequests = options.circuitBreaker?.successThreshold ?? options.circuitBreaker?.halfOpenAttempts;
      const circuitBreaker =
        options.circuitBreaker !== undefined
          ? new CircuitBreaker({
              circuitId,
              failureThreshold: options.circuitBreaker.failureThreshold,
              openDuration: options.circuitBreaker.timeout,
              halfOpenRequests,
            })
          : undefined;
      const timeoutGuard =
        options.lambdaTimeoutReserveMs !== undefined
          ? new LambdaTimeoutGuard({ reserveTimeMs: options.lambdaTimeoutReserveMs })
          : undefined;
      const prototype = Object.getPrototypeOf(this);
      const hasRecover = options.recover !== undefined || getRecoverMethods(prototype).length > 0;

      const callback = circuitBreaker
        ? async (): Promise<unknown> => await circuitBreaker.execute(async () => await originalMethod.apply(this, args))
        : async (): Promise<unknown> => await originalMethod.apply(this, args);

      const additionalHooks = {
        onStart: async (context: RetryContext): Promise<boolean> => {
          if (trace) {
            context.setAttribute('telemetry.span_name', `retry:${methodName}`);
          }

          return true;
        },
        onRetryError: async (error: Error, context: RetryContext): Promise<void> => {
          if (!trace) {
            return;
          }

          recordEvent('retry.attempt_failed', {
            'retry.attempt': context.attempt,
            'retry.method_name': methodName,
            'retry.error_type': error.name,
            'retry.error_message': error.message,
            'retry.will_retry': context.attempt < maxAttempts,
          });
        },
        onSuccess: async (context: RetryContext): Promise<void> => {
          if (!trace) {
            return;
          }

          recordEvent('retry.success', {
            'retry.attempt': context.attempt,
            'retry.method_name': methodName,
          });
        },
        onExhausted: async (_error: Error, context: RetryContext): Promise<void> => {
          if (!trace) {
            return;
          }

          recordEvent('retry.exhausted', {
            'retry.max_attempts': maxAttempts,
            'retry.method_name': methodName,
            'retry.final_error': context.lastError?.name,
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
              methodName
            );
            const lastError = context.lastError ?? fallbackError;
            const recoverableError = context.lastError ?? fallbackError.getOriginalError();

            const recoverMeta = findRecoverMethod(prototype, recoverableError);
            if (recoverMeta) {
              const recoverMethod = (this as Record<string, unknown>)[recoverMeta.methodName];
              if (typeof recoverMethod === 'function') {
                return await recoverMethod.call(this, recoverableError, ...args);
              }
            }

            if (options.recover) {
              const recoverMethod = (this as Record<string, unknown>)[options.recover];
              if (typeof recoverMethod === 'function') {
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
          { ...options, maxAttempts, wrapExhausted },
          additionalHooks,
          recovery
        );

      if (!trace) {
        return await executeWithRetry();
      }

      const retryPolicyName = options.retryPolicy?.constructor.name ?? 'DefaultRetryPolicy';

      return await withSpan(
        async (span) => {
          // Set span attributes
          span.setAttribute('retry.max_attempts', maxAttempts);
          span.setAttribute('retry.method_name', methodName);
          span.setAttribute('retry.policy', retryPolicyName);

          return await executeWithRetry();
        },
        {
          name: `retry:${methodName}`,
          attributes: {
            'retry.max_attempts': maxAttempts,
            'retry.method_name': methodName,
          },
        }
      );
    };

    return descriptor;
  };
}
