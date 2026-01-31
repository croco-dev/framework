import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimitMiddleware, type HttpContext } from '../libs/middleware/rateLimitMiddleware';
import { RateLimitExceededProblem } from '../libs/problems/RateLimitExceededProblem';
import type { RateLimiter } from '../libs/RateLimiter';
import type { RateLimitPolicy, RateLimitResult } from '../libs/types';

describe('createRateLimitMiddleware', () => {
  let mockRateLimiter: RateLimiter;
  const policy: RateLimitPolicy = {
    name: 'test-global',
    limit: 100,
    windowMs: 3600000,
  };

  const successResult: RateLimitResult = {
    success: true,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 3600000,
  };

  const failedResult: RateLimitResult = {
    success: false,
    limit: 100,
    remaining: 0,
    resetAtMs: Date.now() + 3600000,
  };

  const createContext = (overrides: Partial<HttpContext['req']> = {}): HttpContext => {
    const store = new Map<string, unknown>();
    return {
      req: {
        method: 'GET',
        path: '/api/test',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ...overrides,
      },
      set: <T>(key: string, value: T) => {
        store.set(key, value);
      },
      get: <T>(key: string) => store.get(key) as T | undefined,
    };
  };

  beforeEach(() => {
    mockRateLimiter = {
      checkWithKey: vi.fn().mockResolvedValue(successResult),
    } as unknown as RateLimiter;
  });

  it('should allow request within limit', async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.get('rateLimitResult')).toEqual(successResult);
  });

  it('should throw RateLimitExceededProblem when limit exceeded', async () => {
    vi.mocked(mockRateLimiter.checkWithKey).mockResolvedValue(failedResult);
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
    });
    const ctx = createContext();
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow(RateLimitExceededProblem);
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract IP from x-forwarded-for header', async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ['ip'],
    });
    const ctx = createContext({ headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' } });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith(expect.stringContaining('10.0.0.1'), policy);
  });

  it('should store rate limit headers in context', async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      addHeaders: true,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    const headers = ctx.get<Record<string, string>>('rateLimitHeaders');
    expect(headers).toBeDefined();
    expect(headers?.['X-RateLimit-Limit']).toBe('100');
    expect(headers?.['X-RateLimit-Remaining']).toBe('99');
  });

  it('should not add headers when addHeaders is false', async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      addHeaders: false,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(ctx.get('rateLimitHeaders')).toBeUndefined();
  });

  it('should include route in key when keySegments includes route', async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ['ip', 'route'],
    });
    const ctx = createContext({ method: 'POST', path: '/api/orders' });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith(expect.stringContaining('POST:/api/orders'), policy);
  });
});
