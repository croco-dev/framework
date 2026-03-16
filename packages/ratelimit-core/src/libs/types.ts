/**
 * Rate limit policy configuration
 */
import { RateLimitWindowProblem } from './problems/RateLimitConfigProblems';
export type RateLimitPolicy = {
  /** Policy identifier (used as key segment) */
  name: string;
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Algorithm type (reserved for future use) */
  algorithm?: 'sliding';
};

/**
 * Result of a rate limit check
 */
export type RateLimitResult = {
  /** Whether the request is allowed */
  success: boolean;
  degraded?: boolean;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix epoch ms when the window resets */
  resetAtMs: number;
};

/**
 * Key segments for building rate limit keys
 */
export type KeySegment = 'tenant' | 'user' | 'ip' | 'apiKey' | 'route';

/**
 * Options for RateLimiter
 */
export type RateLimiterOptions = {
  /** Key segments to include in rate limit key */
  keySegments: KeySegment[];
  /** Whether to allow requests when store fails (default: true) */
  failOpen?: boolean;
  /** Error callback when store fails */
  onStoreError?: (error: Error) => void;
};

/**
 * Options for @RateLimit decorator
 */
export type RateLimitDecoratorOptions = {
  /** Maximum requests allowed (overrides policy) */
  limit?: number;
  /** Time window string ('1m', '1h', '1d') */
  window?: string;
  /** Pre-defined policy name to use */
  policy?: string;
  /** Custom key resolver function */
  key?: (context: unknown) => string;
};

/**
 * Options for global rate limit middleware
 */
export type RateLimitMiddlewareOptions = {
  /** Rate limit policy to apply */
  policy: RateLimitPolicy;
  /** Key segments to use for building keys */
  keySegments?: KeySegment[];
  /** Whether to allow requests when store fails */
  failOpen?: boolean;
};

/**
 * Parse window string to milliseconds
 * @example '1m' -> 60000, '1h' -> 3600000, '1d' -> 86400000
 */
export function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new RateLimitWindowProblem(`Invalid window format: ${window}. Use format like '1m', '1h', '1d'`);
  }

  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new RateLimitWindowProblem(`Invalid window value: ${window}. Window must be greater than 0`);
  }

  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}
