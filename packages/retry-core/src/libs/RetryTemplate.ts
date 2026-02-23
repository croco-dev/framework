import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from './BackoffPolicy';
import { RetryExhaustedProblem } from './errors/RetryExhaustedProblem';
import { RetryContext } from './RetryContext';
import { executeRetryLoop } from './RetryEngine';
import type { RetryListener } from './RetryListener';
import { CompositeRetryListener } from './RetryListener';
import { DefaultRetryPolicy, type RetryPolicy, type RetryPolicyOptions } from './RetryPolicy';

/**
 * Options for RetryTemplate.
 */
export interface RetryTemplateOptions extends RetryPolicyOptions {
  /** Backoff configuration */
  backoff?: BackoffOptions;

  /** Custom retry policy (overrides retryFor/noRetryFor) */
  retryPolicy?: RetryPolicy;

  /** Custom backoff policy (overrides backoff options) */
  backoffPolicy?: BackoffPolicy;

  /** Wrap exhausted error instead of re-throwing last error */
  wrapExhausted?: boolean;

  /** Retry listeners for lifecycle hooks */
  listeners?: RetryListener[];
}

/**
 * Recovery callback for handling exhausted retries.
 */
export type RecoveryCallback<T> = (context: RetryContext) => T | Promise<T>;

/**
 * Retry operation callback.
 */
export type RetryCallback<T> = (context: RetryContext) => T | Promise<T>;

/**
 * Programmatic retry template.
 *
 * @example
 * ```typescript
 * const template = new RetryTemplate({ maxAttempts: 3 });
 * const result = await template.execute(
 *   async (ctx) => await riskyOperation(),
 *   async (ctx) => fallbackValue
 * );
 * ```
 */
export class RetryTemplate {
  private readonly retryPolicy: RetryPolicy;
  private readonly backoffPolicy: BackoffPolicy;
  private readonly maxAttempts: number;
  private readonly wrapExhausted: boolean;
  private readonly listener: CompositeRetryListener | null;

  constructor(options: RetryTemplateOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.wrapExhausted = options.wrapExhausted ?? false;

    this.retryPolicy =
      options.retryPolicy ??
      new DefaultRetryPolicy({
        retryFor: options.retryFor,
        noRetryFor: options.noRetryFor,
        retryForCategories: options.retryForCategories,
        maxAttempts: this.maxAttempts,
      });

    this.backoffPolicy = options.backoffPolicy ?? new ExponentialBackoff(options.backoff);

    this.listener =
      options.listeners && options.listeners.length > 0 ? new CompositeRetryListener(options.listeners) : null;
  }

  /**
   * Execute operation with retry logic.
   *
   * @param callback The operation to retry
   * @param recovery Optional recovery callback for exhausted retries
   * @returns Result of callback or recovery
   */
  async execute<T>(callback: RetryCallback<T>, recovery?: RecoveryCallback<T>): Promise<T> {
    const context = new RetryContext('execute', [], this.maxAttempts);

    try {
      return await executeRetryLoop(
        async () => await callback(context),
        {
          maxAttempts: this.maxAttempts,
          retryPolicy: this.retryPolicy,
          backoffPolicy: this.backoffPolicy,
          context,
        },
        {
          onStart: async (retryContext) => {
            if (!this.listener) {
              return true;
            }
            return await this.listener.onStart(retryContext);
          },
          onRetryError: async (error, retryContext) => {
            if (this.listener) {
              await this.listener.onError(retryContext, error);
            }
          },
          onSuccess: async (retryContext) => {
            if (this.listener) {
              await this.listener.onSuccess(retryContext);
            }
          },
          onExhausted: async (_error, retryContext) => {
            if (this.listener) {
              await this.listener.onExhausted(retryContext);
            }
          },
        }
      );
    } catch (error) {
      const retryError = error instanceof Error ? error : new Error(String(error));

      if (!context.exhausted) {
        throw retryError;
      }

      if (recovery) {
        return await recovery(context);
      }

      if (this.wrapExhausted) {
        throw RetryExhaustedProblem.fromContext('execute', this.maxAttempts, context.lastError);
      }

      throw (
        context.lastError ??
        new RetryExhaustedProblem(`Retry exhausted after ${this.maxAttempts} attempts`, null, this.maxAttempts)
      );
    }
  }
}
