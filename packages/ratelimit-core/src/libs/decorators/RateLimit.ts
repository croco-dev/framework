import 'reflect-metadata';
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitGuard,
  type RateLimitMetadata,
  ROUTE_GUARDS_METADATA_KEY,
} from '../guards/RateLimitGuard';
import { parseWindowMs, type RateLimitAlgorithm, type RateLimitPolicy } from '../types';

const DEFAULTS = {
  limit: 100,
  window: '1m',
  policyName: 'default',
  algorithm: 'sliding' as RateLimitAlgorithm,
};

export type RateLimitDecoratorOptions = {
  limit?: number;
  window?: string;
  policy?: string;
  algorithm?: RateLimitAlgorithm;
  key?: (context: unknown) => string;
};

export function RateLimit(options: RateLimitDecoratorOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const policy: RateLimitPolicy = {
      name: options.policy ?? `${String(propertyKey)}-${DEFAULTS.policyName}`,
      algorithm: options.algorithm ?? DEFAULTS.algorithm,
      limit: options.limit ?? DEFAULTS.limit,
      windowMs: parseWindowMs(options.window ?? DEFAULTS.window),
    };

    const metadata: RateLimitMetadata = {
      policy,
      customKey: options.key,
    };

    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, descriptor.value);

    const existingGuards =
      (Reflect.getMetadata(ROUTE_GUARDS_METADATA_KEY, _target.constructor, propertyKey) as unknown[]) || [];

    if (!existingGuards.includes(RateLimitGuard)) {
      Reflect.defineMetadata(
        ROUTE_GUARDS_METADATA_KEY,
        [...existingGuards, RateLimitGuard],
        _target.constructor,
        propertyKey
      );
    }

    return descriptor;
  };
}
