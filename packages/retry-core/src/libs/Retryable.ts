import { recordEvent, withSpan } from '@croco/telemetry-api';
import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from './BackoffPolicy';
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitState } from './CircuitBreakerState';
import { CircuitBreakerOpenProblem } from './errors/CircuitBreakerOpenProblem';
import { RetryExhaustedProblem } from './errors/RetryExhaustedProblem';
import { LambdaTimeoutGuard } from './LambdaTimeoutGuard';
import { findRecoverMethod } from './Recover';
import { RetryContext } from './RetryContext';
import { executeRetryLoop } from './RetryEngine';
import { CompositeRetryListener, type RetryListener } from './RetryListener';
import { DefaultRetryPolicy, type RetryPolicy, type RetryPolicyOptions } from './RetryPolicy';

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

  /** Reserve time for Lambda timeout (ms) */
  lambdaTimeoutReserveMs?: number;
}

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

  const retryPolicy =
    options.retryPolicy ??
    new DefaultRetryPolicy({
      retryFor: options.retryFor,
      noRetryFor: options.noRetryFor,
      retryForCategories: options.retryForCategories,
      maxAttempts,
    });

  const backoffPolicy = options.backoffPolicy ?? new ExponentialBackoff(options.backoff);
  const listener =
    options.listeners && options.listeners.length > 0 ? new CompositeRetryListener(options.listeners) : null;

  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const targetName = (_target as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownTarget';
    const circuitId = `${targetName}.${methodName}`;
    const halfOpenRequests = options.circuitBreaker?.successThreshold ?? options.circuitBreaker?.halfOpenAttempts;
    const circuitBreaker =
      options.circuitBreaker !== undefined
        ? new CircuitBreaker({
            circuitId,
            failureThreshold: options.circuitBreaker.failureThreshold,
            openDuration: options.circuitBreaker.timeout,
            halfOpenRequests,
          })
        : null;
    const timeoutGuard =
      options.lambdaTimeoutReserveMs !== undefined
        ? new LambdaTimeoutGuard({ reserveTimeMs: options.lambdaTimeoutReserveMs })
        : null;
    const effectiveRetryPolicy: RetryPolicy =
      circuitBreaker !== null
        ? {
            shouldRetry(error: unknown, attempt: number, configuredMaxAttempts: number): boolean {
              if (error instanceof CircuitBreakerOpenProblem) {
                return false;
              }

              return retryPolicy.shouldRetry(error, attempt, configuredMaxAttempts);
            },
          }
        : retryPolicy;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const executeWithRetry = async (): Promise<unknown> => {
        const context = new RetryContext(methodName, args, maxAttempts);

        try {
          return await executeRetryLoop(
            async () => {
              if (circuitBreaker) {
                return await circuitBreaker.execute(async () => await originalMethod.apply(this, args));
              }

              return await originalMethod.apply(this, args);
            },
            {
              maxAttempts,
              retryPolicy: effectiveRetryPolicy,
              backoffPolicy,
              context,
            },
            {
              onStart: async (retryContext) => {
                if (listener) {
                  const shouldStart = await listener.onStart(retryContext);
                  if (!shouldStart) {
                    return false;
                  }
                }

                if (trace) {
                  retryContext.setAttribute('telemetry.span_name', `retry:${methodName}`);
                }

                return true;
              },
              onRetryError: async (error, retryContext) => {
                if (listener) {
                  await listener.onError(retryContext, error);
                }

                if (!trace) {
                  return;
                }

                const canRetry = effectiveRetryPolicy.shouldRetry(error, retryContext.attempt, maxAttempts);

                recordEvent('retry.attempt_failed', {
                  'retry.attempt': retryContext.attempt,
                  'retry.method_name': methodName,
                  'retry.error_type': error.name,
                  'retry.error_message': error.message,
                  'retry.will_retry': canRetry && retryContext.attempt < maxAttempts,
                });
              },
              onSuccess: async (retryContext) => {
                if (listener) {
                  await listener.onSuccess(retryContext);
                }

                if (!trace) {
                  return;
                }

                recordEvent('retry.success', {
                  'retry.attempt': retryContext.attempt,
                  'retry.method_name': methodName,
                });
              },
              onExhausted: async (_error, retryContext) => {
                if (listener) {
                  await listener.onExhausted(retryContext);
                }

                if (!trace) {
                  return;
                }

                recordEvent('retry.exhausted', {
                  'retry.max_attempts': maxAttempts,
                  'retry.method_name': methodName,
                  'retry.final_error': retryContext.lastError?.name,
                });
              },
              beforeWait: async (delay) => {
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
            }
          );
        } catch (error) {
          const retryError = error instanceof Error ? error : new Error(String(error));

          if (!context.exhausted) {
            throw retryError;
          }

          // Try recovery method if specified
          if (options.recover) {
            const recoverMethod = (this as Record<string, unknown>)[options.recover];
            if (typeof recoverMethod === 'function') {
              return await recoverMethod.call(this, context.lastError, ...args);
            }
          }

          // Try @Recover decorated method if no explicit recover option
          if (!options.recover && context.lastError) {
            const recoverMeta = findRecoverMethod(Object.getPrototypeOf(this), context.lastError);
            if (recoverMeta) {
              const recoverMethod = (this as Record<string, unknown>)[recoverMeta.methodName];
              if (typeof recoverMethod === 'function') {
                return await recoverMethod.call(this, context.lastError, ...args);
              }
            }
          }

          // Re-throw last error or wrap
          if (wrapExhausted) {
            throw RetryExhaustedProblem.fromContext(methodName, maxAttempts, context.lastError);
          }

          throw (
            context.lastError ??
            new RetryExhaustedProblem(
              `Retry exhausted after ${maxAttempts} attempts for '${methodName}'`,
              null,
              maxAttempts,
              methodName
            )
          );
        }
      };

      if (!trace) {
        return await executeWithRetry();
      }

      return await withSpan(
        async (span) => {
          // Set span attributes
          span.setAttribute('retry.max_attempts', maxAttempts);
          span.setAttribute('retry.method_name', methodName);
          span.setAttribute('retry.policy', retryPolicy.constructor.name);

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
