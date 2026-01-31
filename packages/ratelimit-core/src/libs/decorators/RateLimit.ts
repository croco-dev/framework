import 'reflect-metadata';
import { REST_GUARDS_KEY } from '@croco/protocols-rest';
import { RATE_LIMIT_METADATA_KEY, RateLimitGuard, type RateLimitMetadata } from '../guards/RateLimitGuard';
import { parseWindowMs, type RateLimitDecoratorOptions, type RateLimitPolicy } from '../types';

/**
 * Default rate limit values when not specified.
 */
const DEFAULTS = {
  limit: 100,
  window: '1m',
  policyName: 'default',
} as const;

/**
 * Method decorator that applies rate limiting to an endpoint.
 * Automatically registers RateLimitGuard - no need for @UseGuards(RateLimitGuard).
 *
 * @example
 * ```typescript
 * @RateLimit({ limit: 10, window: '1m' })
 * @Get('/expensive')
 * async expensiveOperation() {}
 * ```
 *
 * @example
 * ```typescript
 * // Dynamic limit based on context
 * @RateLimit({
 *   limit: 100,
 *   window: '1h',
 *   key: (ctx) => ctx.get('tenant')?.id
 * })
 * @Post('/api')
 * async apiCall() {}
 * ```
 */
export function RateLimit(options: RateLimitDecoratorOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const policy: RateLimitPolicy = {
      name: options.policy ?? `${String(propertyKey)}-${DEFAULTS.policyName}`,
      limit: options.limit ?? DEFAULTS.limit,
      windowMs: parseWindowMs(options.window ?? DEFAULTS.window),
    };

    const metadata: RateLimitMetadata = {
      policy,
      customKey: options.key,
    };

    // Store rate limit metadata
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, descriptor.value);

    // Auto-register RateLimitGuard (no need for @UseGuards)
    const existingGuards: unknown[] = Reflect.getMetadata(REST_GUARDS_KEY, _target.constructor, propertyKey) || [];
    if (!existingGuards.includes(RateLimitGuard)) {
      Reflect.defineMetadata(REST_GUARDS_KEY, [...existingGuards, RateLimitGuard], _target.constructor, propertyKey);
    }

    return descriptor;
  };
}
