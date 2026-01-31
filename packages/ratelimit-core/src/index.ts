// @croco/ratelimit-core
// Rate limiting for croco framework

// Decorator
export { RateLimit } from './libs/decorators/RateLimit';
export type { GuardContext, RateLimitMetadata } from './libs/guards/RateLimitGuard';
// Guard
export { RATE_LIMIT_METADATA_KEY, RateLimitGuard } from './libs/guards/RateLimitGuard';
export { InMemoryRateLimitStore } from './libs/InMemoryRateLimitStore';
export type {
  CreateMiddlewareOptions,
  HttpContext,
  MiddlewareFunction,
  RateLimitHeaders,
} from './libs/middleware/rateLimitMiddleware';
// Middleware
export { createRateLimitMiddleware } from './libs/middleware/rateLimitMiddleware';
// Problem
export { RateLimitExceededProblem } from './libs/problems/RateLimitExceededProblem';
// Core
export { RateLimiter } from './libs/RateLimiter';
export type { KeyContext } from './libs/RateLimitKeyBuilder';
export { RateLimitKeyBuilder } from './libs/RateLimitKeyBuilder';
// Store
export type { RateLimitStore } from './libs/RateLimitStore';
// Types
export type {
  KeySegment,
  RateLimitDecoratorOptions,
  RateLimiterOptions,
  RateLimitMiddlewareOptions,
  RateLimitPolicy,
  RateLimitResult,
} from './libs/types';
export { parseWindowMs } from './libs/types';
