import { RateLimitExceededProblem } from '../problems/RateLimitExceededProblem';
import type { RateLimiter } from '../RateLimiter';
import { RateLimitKeyBuilder } from '../RateLimitKeyBuilder';
import type { KeySegment, RateLimitPolicy, RateLimitResult } from '../types';

/**
 * CrocoHttpContext interface (compatible with transports-http).
 * Defined here to avoid circular dependency.
 */
export interface HttpContext {
  readonly req: {
    method: string;
    path: string;
    headers: Record<string, string>;
  };
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
}

/**
 * Middleware function signature.
 */
export type MiddlewareFunction = (ctx: HttpContext, next: () => Promise<void>) => Promise<void> | void;

/**
 * Options for creating rate limit middleware.
 */
export type CreateMiddlewareOptions = {
  /** RateLimiter instance */
  rateLimiter: RateLimiter;
  /** Rate limit policy */
  policy: RateLimitPolicy;
  /** Key segments for building rate limit key (default: ['ip']) */
  keySegments?: KeySegment[];
  /** Whether to add X-RateLimit-* headers (default: true) */
  addHeaders?: boolean;
};

/**
 * Response headers for rate limiting.
 */
export type RateLimitHeaders = {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
};

/**
 * Creates a rate limiting middleware for global application.
 *
 * @example
 * ```typescript
 * const middleware = createRateLimitMiddleware({
 *   rateLimiter,
 *   policy: { name: 'global', limit: 1000, windowMs: 3600000 },
 *   keySegments: ['tenant', 'ip'],
 * });
 *
 * // In CrocoApp config
 * { middlewares: [middleware] }
 * ```
 */
export function createRateLimitMiddleware(options: CreateMiddlewareOptions): MiddlewareFunction {
  const { rateLimiter, policy, keySegments = ['ip'], addHeaders = true } = options;
  const keyBuilder = new RateLimitKeyBuilder(keySegments);

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // Build context adapter for key extraction
    const keyContext = createKeyContext(ctx);
    const key = keyBuilder.build(keyContext, policy.name);

    // Check rate limit
    const result = await rateLimiter.checkWithKey(key, policy);

    // Store result for downstream use
    ctx.set('rateLimitResult', result);

    // Set headers if enabled
    if (addHeaders) {
      const headers = buildHeaders(result);
      ctx.set('rateLimitHeaders', headers);
    }

    // Check if limit exceeded
    if (!result.success) {
      throw new RateLimitExceededProblem(result);
    }

    await next();
  };
}

/**
 * Creates a key context adapter from HTTP context.
 */
function createKeyContext(ctx: HttpContext) {
  return {
    get<T>(key: string): T | undefined {
      // First check context store
      const stored = ctx.get<T>(key);
      if (stored !== undefined) return stored;

      // Map common HTTP values
      switch (key) {
        case 'ip':
        case 'clientIp':
          return (ctx.req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            ctx.req.headers['x-real-ip'] ??
            'unknown') as T;
        case 'method':
          return ctx.req.method as T;
        case 'path':
          return ctx.req.path as T;
        default:
          return undefined;
      }
    },
  };
}

/**
 * Builds rate limit headers from result.
 */
function buildHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  };

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAtMs - Date.now()) / 1000);
    headers['Retry-After'] = String(Math.max(0, retryAfter));
  }

  return headers;
}
