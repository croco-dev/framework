import { Problem, ProblemCategory } from '@croco/problems-core';
import type { RateLimitResult } from '../types';

/**
 * Problem thrown when rate limit is exceeded.
 * RFC 7807 compliant with rate limit extensions.
 */
export class RateLimitExceededProblem extends Problem {
  /**
   * Time in milliseconds until the rate limit resets.
   */
  readonly retryAfterMs: number;

  constructor(result: RateLimitResult) {
    super(
      'RATE_LIMIT_EXCEEDED',
      ProblemCategory.TooManyRequests,
      'Rate limit exceeded. Please retry after the reset time.',
      {
        extensions: {
          limit: result.limit,
          remaining: 0,
          resetAt: new Date(result.resetAtMs).toISOString(),
          retryAfterSeconds: Math.ceil((result.resetAtMs - Date.now()) / 1000),
        },
      }
    );

    this.retryAfterMs = Math.max(0, result.resetAtMs - Date.now());
  }

  /**
   * Get Retry-After header value in seconds.
   */
  get retryAfterSeconds(): number {
    return Math.ceil(this.retryAfterMs / 1000);
  }
}
