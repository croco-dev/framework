import { RateLimitExceededProblem } from '../problems/RateLimitExceededProblem';
import type { RateLimiter } from '../RateLimiter';
import type { KeyContext } from '../RateLimitKeyBuilder';
import type { RateLimitPolicy } from '../types';

type Guard<TContext = unknown> = {
  canActivate(context: TContext): boolean | Promise<boolean>;
};

/**
 * Metadata key for @RateLimit decorator.
 */
export const RATE_LIMIT_METADATA_KEY = Symbol('rateLimit');
export const ROUTE_GUARDS_METADATA_KEY = Symbol.for('croco:rest:guards');

/**
 * Rate limit metadata stored by @RateLimit decorator.
 */
export type RateLimitMetadata = {
  policy: RateLimitPolicy;
  customKey?: (context: unknown) => string;
};

/**
 * Execution context interface for guard.
 * Compatible with protocols-rest ExecutionContext.
 */
export type GuardContext = KeyContext & {
  /** The handler method being invoked */
  getHandler(): (...args: unknown[]) => unknown;
  /** Set a value in the context (for passing result to middleware) */
  set<T>(key: string, value: T): void;
};

/**
 * Guard that enforces rate limiting on decorated methods.
 * Reads metadata from @RateLimit decorator and checks against RateLimiter.
 */
export class RateLimitGuard implements Guard<GuardContext> {
  constructor(private readonly rateLimiter: RateLimiter) {}

  async canActivate(context: GuardContext): Promise<boolean> {
    const handler = context.getHandler();
    const metadata = Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, handler) as RateLimitMetadata | undefined;

    // No rate limit metadata = allow request
    if (!metadata) {
      return true;
    }

    // Check rate limit
    const result = await this.rateLimiter.check(context, metadata.policy);

    // Store result in context for header injection
    context.set('rateLimitResult', result);

    if (!result.success) {
      throw new RateLimitExceededProblem(result);
    }

    return true;
  }
}
