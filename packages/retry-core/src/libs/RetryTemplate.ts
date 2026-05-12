import type { BackoffOptions, BackoffPolicy } from "./BackoffPolicy";
import { InvalidRetryConfigurationError } from "./errors/RetryInfrastructureProblem";
import type { RetryContext } from "./RetryContext";
import type { RetryListener } from "./RetryListener";
import { RetryOrchestrator } from "./RetryOrchestrator";
import type { RetryPolicy, RetryPolicyOptions } from "./RetryPolicy";

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
  constructor(private readonly options: RetryTemplateOptions = {}) {
    const maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0 || Number.isNaN(maxAttempts)) {
      throw new InvalidRetryConfigurationError(
        `maxAttempts must be a positive integer, got ${maxAttempts}`,
      );
    }
  }

  /**
   * Execute operation with retry logic.
   *
   * @param callback The operation to retry
   * @param recovery Optional recovery callback for exhausted retries
   * @returns Result of callback or recovery
   */
  async execute<T>(callback: RetryCallback<T>, recovery?: RecoveryCallback<T>): Promise<T> {
    let context!: RetryContext;

    return await RetryOrchestrator.execute(
      "execute",
      [],
      async () => await callback(context),
      this.options,
      {
        onStart: async (retryContext) => {
          context = retryContext;
          return true;
        },
      },
      recovery,
    );
  }
}
