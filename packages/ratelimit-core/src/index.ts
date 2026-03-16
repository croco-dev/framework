/**
 * @packageDocumentation
 * Public API for rate limit decorators, guards, middleware, stores, and policies.
 */

/** Decorator for declaring rate limit policies on handlers. */
export { RateLimit } from './libs/decorators/RateLimit';

/** Guard execution context and metadata types. */
export type { GuardContext, RateLimitMetadata } from './libs/guards/RateLimitGuard';

/** Rate limit metadata key and guard implementation. */
export { RATE_LIMIT_METADATA_KEY, RateLimitGuard } from './libs/guards/RateLimitGuard';

/** In-memory rate limit store implementation. */
export { InMemoryRateLimitStore } from './libs/InMemoryRateLimitStore';

/** Middleware context, headers, and configuration types. */
export type {
  CreateMiddlewareOptions,
  HttpContext,
  MiddlewareFunction,
  RateLimitHeaders,
} from './libs/middleware/rateLimitMiddleware';

/** Factory for creating HTTP rate limit middleware. */
export { createRateLimitMiddleware } from './libs/middleware/rateLimitMiddleware';
export { RateLimitKeyBuilderProblem, RateLimitWindowProblem } from './libs/problems/RateLimitConfigProblems';
/** Problem raised when a request exceeds the configured limit. */
export { RateLimitExceededProblem } from './libs/problems/RateLimitExceededProblem';

/** Core service that evaluates policies against a store. */
export { RateLimiter } from './libs/RateLimiter';

/** Context type used when building rate limit keys. */
export type { KeyContext } from './libs/RateLimitKeyBuilder';

/** Builder that derives rate limit keys from request context. */
export { RateLimitKeyBuilder } from './libs/RateLimitKeyBuilder';

/** Store contract for custom rate limit persistence implementations. */
export { RateLimitStore } from './libs/RateLimitStore';

/** Core policy, decorator, and middleware option types. */
export type {
  KeySegment,
  RateLimitDecoratorOptions,
  RateLimiterOptions,
  RateLimitMiddlewareOptions,
  RateLimitPolicy,
  RateLimitResult,
} from './libs/types';

/** Parses a shorthand window string into milliseconds. */
export { parseWindowMs } from './libs/types';
