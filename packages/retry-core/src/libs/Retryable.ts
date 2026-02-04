import { recordEvent, withSpan } from '@croco/telemetry-api';
import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from './BackoffPolicy';
import { RetryExhaustedException } from './errors/RetryExhaustedException';
import { findRecoverMethod } from './Recover';
import { RetryContext } from './RetryContext';
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

  const retryPolicy =
    options.retryPolicy ??
    new DefaultRetryPolicy({
      retryFor: options.retryFor,
      noRetryFor: options.noRetryFor,
      retryForCategories: options.retryForCategories,
      maxAttempts,
    });

  const backoffPolicy = options.backoffPolicy ?? new ExponentialBackoff(options.backoff);

  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      return await withSpan(
        async (span) => {
          const context = new RetryContext(methodName, args, maxAttempts);

          // Set span attributes
          span.setAttribute('retry.max_attempts', maxAttempts);
          span.setAttribute('retry.method_name', methodName);
          span.setAttribute('retry.policy', retryPolicy.constructor.name);

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            context.incrementAttempt();

            try {
              const result = await originalMethod.apply(this, args);

              // Record success event
              recordEvent('retry.success', {
                'retry.attempt': attempt,
                'retry.method_name': methodName,
              });

              return result;
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              context.setLastError(err);

              const shouldRetry = retryPolicy.shouldRetry(err, attempt, maxAttempts);

              // Record attempt failed event
              recordEvent('retry.attempt_failed', {
                'retry.attempt': attempt,
                'retry.method_name': methodName,
                'retry.error_type': err.name,
                'retry.error_message': err.message,
                'retry.will_retry': shouldRetry && attempt < maxAttempts,
              });

              if (!shouldRetry && attempt < maxAttempts) {
                throw err;
              }

              if (attempt < maxAttempts && shouldRetry) {
                await backoffPolicy.wait(attempt - 1);
              }
            }
          }

          // All attempts exhausted
          context.setExhausted();

          // Record exhausted event
          recordEvent('retry.exhausted', {
            'retry.max_attempts': maxAttempts,
            'retry.method_name': methodName,
            'retry.final_error': context.lastError?.name,
          });

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
            throw RetryExhaustedException.fromContext(methodName, maxAttempts, context.lastError);
          }

          throw (
            context.lastError ??
            new RetryExhaustedException(
              `Retry exhausted after ${maxAttempts} attempts for '${methodName}'`,
              null,
              maxAttempts,
              methodName
            )
          );
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
