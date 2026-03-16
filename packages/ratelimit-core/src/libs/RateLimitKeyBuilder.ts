import { RateLimitKeyBuilderProblem } from './problems/RateLimitConfigProblems';
import type { KeySegment } from './types';

/**
 * Context interface for extracting rate limit key segments.
 * Compatible with ExecutionContext and CrocoHttpContext.
 */
export type KeyContext = {
  get<T>(key: string): T | undefined;
};

/**
 * Builds rate limit keys from context using configurable segments.
 *
 * @example
 * const builder = new RateLimitKeyBuilder(['tenant', 'user', 'route']);
 * const key = builder.build(context, 'api-default');
 * // Result: "rl:api-default:tenant_123:user_456::GET:/api/users"
 */
export class RateLimitKeyBuilder {
  private readonly segments: KeySegment[];

  constructor(segments: KeySegment[]) {
    if (segments.length === 0) {
      throw new RateLimitKeyBuilderProblem('At least one key segment is required');
    }
    this.segments = segments;
  }

  /**
   * Build a rate limit key from context.
   * @param context - Context containing segment values
   * @param policyName - Policy identifier
   * @returns Composite key string
   */
  build(context: KeyContext, policyName: string): string {
    const parts: string[] = ['rl', policyName];

    for (const segment of this.segments) {
      const value = this.extractSegment(context, segment);
      parts.push(value ?? '');
    }

    return parts.join(':');
  }

  private extractSegment(context: KeyContext, segment: KeySegment): string | undefined {
    switch (segment) {
      case 'tenant':
        return context.get<{ id: string }>('tenant')?.id ?? context.get<string>('tenantId');
      case 'user':
        return context.get<{ id: string }>('user')?.id ?? context.get<string>('userId');
      case 'ip':
        return context.get<string>('ip') ?? context.get<string>('clientIp');
      case 'apiKey':
        return context.get<string>('apiKey');
      case 'route':
        return this.buildRouteKey(context);
      default:
        return undefined;
    }
  }

  private buildRouteKey(context: KeyContext): string | undefined {
    const method = context.get<string>('method');
    const path = context.get<string>('path');

    if (method && path) {
      return `${method}:${path}`;
    }
    return undefined;
  }
}
