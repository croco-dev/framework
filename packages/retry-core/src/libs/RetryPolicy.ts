import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Determines whether an error should trigger a retry.
 */
export interface RetryPolicy {
  /**
   * Check if the given error should be retried.
   * @param error The error that occurred
   * @param attempt Current attempt number (1-based)
   * @param maxAttempts Maximum allowed attempts
   * @returns true if should retry, false otherwise
   */
  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean;
}

/**
 * Options for configuring retry behavior.
 */
export interface RetryPolicyOptions {
  /** Exception classes to retry (empty = retry all except noRetryFor) */
  retryFor?: Array<new (message?: string) => Error>;

  /** Exception classes to never retry */
  noRetryFor?: Array<new (message?: string) => Error>;

  /** ProblemCategory values to retry (croco integration) */
  retryForCategories?: ProblemCategory[];

  /** Positive safe-integer maximum attempts (default: 3). */
  maxAttempts?: number;
}

/** Default retryable categories (transient errors) */
export const DEFAULT_RETRYABLE_CATEGORIES: ProblemCategory[] = [
  ProblemCategory.InternalServerError, // 500 - server error
  ProblemCategory.TooManyRequests, // 429 - rate limiting
];

/** Default non-retryable error types (programmer errors) */
export const DEFAULT_NO_RETRY_FOR: Array<new (message?: string) => Error> = [
  TypeError,
  ReferenceError,
  SyntaxError,
  RangeError,
];

/**
 * Default retry policy with ProblemCategory support.
 */
export class DefaultRetryPolicy implements RetryPolicy {
  private readonly retryFor: Array<new (message?: string) => Error>;
  private readonly noRetryFor: Array<new (message?: string) => Error>;
  private readonly retryForCategories: ProblemCategory[];

  constructor(options: RetryPolicyOptions = {}) {
    this.retryFor = options.retryFor ?? [];
    this.noRetryFor = options.noRetryFor ?? DEFAULT_NO_RETRY_FOR;
    this.retryForCategories = options.retryForCategories ?? DEFAULT_RETRYABLE_CATEGORIES;
  }

  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    // No more attempts left
    if (attempt >= maxAttempts) {
      return false;
    }

    // Check noRetryFor first (highest priority)
    if (error instanceof Error && this.noRetryFor.some((cls) => error instanceof cls)) {
      return false;
    }

    // Check explicit retryFor
    if (this.retryFor.length > 0 && error instanceof Error) {
      if (this.retryFor.some((cls) => error instanceof cls)) {
        return true;
      }
    }

    // Check ProblemCategory (croco-specific)
    if (error instanceof Problem) {
      return this.retryForCategories.includes(error.category);
    }

    // Default: retry if retryFor is empty (except noRetryFor already checked)
    return this.retryFor.length === 0;
  }
}
