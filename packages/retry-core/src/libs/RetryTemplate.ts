import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from './BackoffPolicy';
import { RetryExhaustedException } from './errors/RetryExhaustedException';
import { RetryContext } from './RetryContext';
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

    if (this.listener) {
      const shouldStart = await this.listener.onStart(context);
      if (!shouldStart) {
        throw new Error('Retry aborted by listener');
      }
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      context.incrementAttempt();

      try {
        const result = await callback(context);

        if (this.listener) {
          await this.listener.onSuccess(context);
        }
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        context.setLastError(err);

        if (this.listener) {
          await this.listener.onError(context, err);
        }

        const shouldRetry = this.retryPolicy.shouldRetry(err, attempt, this.maxAttempts);
        const isLastAttempt = attempt === this.maxAttempts;
        const isNonRetryable =
          !shouldRetry && (!isLastAttempt || !this.retryPolicy.shouldRetry(err, attempt, this.maxAttempts + 1));

        if (isNonRetryable) {
          throw err;
        }

        if (attempt < this.maxAttempts && shouldRetry) {
          await this.backoffPolicy.wait(attempt - 1);
        }
      }
    }

    context.setExhausted();

    if (this.listener) {
      await this.listener.onExhausted(context);
    }

    if (recovery) {
      return await recovery(context);
    }

    if (this.wrapExhausted) {
      throw RetryExhaustedException.fromContext('execute', this.maxAttempts, context.lastError);
    }

    throw (
      context.lastError ??
      new RetryExhaustedException(`Retry exhausted after ${this.maxAttempts} attempts`, null, this.maxAttempts)
    );
  }
}
