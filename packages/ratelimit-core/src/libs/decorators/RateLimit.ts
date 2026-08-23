import "reflect-metadata";
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitGuard,
  type RateLimitMetadata,
  ROUTE_GUARDS_METADATA_KEY,
} from "../guards/RateLimitGuard";
import { RateLimitUnexpectedPolicyProblem } from "../problems/RateLimitConfigProblems";
import { parseWindowMs, type FixedWindowPolicy, type SlidingWindowPolicy } from "../types";

const DEFAULTS = {
  limit: 100,
  window: "1m",
  policyName: "default",
  algorithm: "sliding",
} as const;

export type RateLimitDecoratorOptions = {
  limit?: number;
  window?: string;
  policy?: string;
  algorithm?: "fixed" | "sliding";
  key?: (context: unknown) => string;
};

export function RateLimit(options: RateLimitDecoratorOptions = {}): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const name = options.policy ?? `${String(propertyKey)}-${DEFAULTS.policyName}`;
    const limit = options.limit ?? DEFAULTS.limit;
    const windowMs = parseWindowMs(options.window ?? DEFAULTS.window);
    const algorithm = options.algorithm ?? DEFAULTS.algorithm;
    const policy = createWindowPolicy(algorithm, name, limit, windowMs);

    const metadata: RateLimitMetadata = {
      policy,
      customKey: options.key,
    };

    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, descriptor.value);

    const existingGuards =
      (Reflect.getMetadata(
        ROUTE_GUARDS_METADATA_KEY,
        _target.constructor,
        propertyKey,
      ) as unknown[]) || [];

    if (!existingGuards.includes(RateLimitGuard)) {
      Reflect.defineMetadata(
        ROUTE_GUARDS_METADATA_KEY,
        [...existingGuards, RateLimitGuard],
        _target.constructor,
        propertyKey,
      );
    }

    return descriptor;
  };
}

function createWindowPolicy(
  algorithm: "fixed" | "sliding",
  name: string,
  limit: number,
  windowMs: number,
): FixedWindowPolicy | SlidingWindowPolicy {
  switch (algorithm) {
    case "fixed":
      return { name, algorithm, limit, windowMs };
    case "sliding":
      return { name, algorithm, limit, windowMs };
    default:
      return assertNever(algorithm);
  }
}

function assertNever(value: never): never {
  throw new RateLimitUnexpectedPolicyProblem("decorator", value);
}
