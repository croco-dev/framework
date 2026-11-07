import { Problem, ProblemCategory, readExplicitRetryability } from "@croco/problems-core";
import { RetrySuccessHookProblem } from "./errors";
import { unwrapCircuitBreakerBookkeepingError } from "./errors/CircuitBreakerBookkeepingProblem";

/**
 * Determines whether an error should trigger a retry.
 */
export interface RetryPolicy {
  /**
   * Check if the given error should be retried.
   * Called once per failed operation with its actual attempt and configured limit.
   * A false result is terminal unless the final failure is classified by `isRetryable`.
   * @param error The error that occurred
   * @param attempt Current attempt number (1-based)
   * @param maxAttempts Maximum allowed attempts
   * @returns true if should retry, false otherwise
   */
  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean;

  /**
   * Classify the final error independently of the attempt budget, without scheduling another attempt.
   * Called only when `shouldRetry` rejects the final failure. A true result enables exhaustion
   * hooks and recovery; false (or an absent classifier) propagates the original error directly.
   */
  isRetryable?(error: unknown): boolean;
}

/**
 * Options for configuring retry behavior.
 */
export interface RetryPolicyOptions {
  /**
   * Exception classes to always retry. Other Problems follow `retryForCategories`, and other errors
   * retry only while this list is empty. `noRetryFor` and an explicit `retryable` flag on the error win.
   */
  retryFor?: Array<new (message?: string) => Error>;

  /** Exception classes to never retry, even when the error declares `retryable: true` */
  noRetryFor?: Array<new (message?: string) => Error>;

  /** ProblemCategory values to retry (croco integration); an explicit `retryable` flag on the error wins */
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
 * Default retry policy that honors an error's explicit `retryable` classification before ProblemCategory.
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

    return this.isRetryable(error);
  }

  /** Classify an error without applying the attempt limit. */
  isRetryable(error: unknown): boolean {
    error = unwrapCircuitBreakerBookkeepingError(error);

    if (error instanceof RetrySuccessHookProblem) {
      return false;
    }

    // Check noRetryFor first (highest priority)
    if (error instanceof Error && this.noRetryFor.some((cls) => error instanceof cls)) {
      return false;
    }

    const explicitRetryability = readExplicitRetryability(error);
    if (explicitRetryability !== undefined) {
      return explicitRetryability;
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
