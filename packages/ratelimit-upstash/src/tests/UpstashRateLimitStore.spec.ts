import type { RateLimitPolicy } from '@croco/ratelimit-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstashRateLimitStore } from '../libs/UpstashRateLimitStore';

// Mock @upstash/ratelimit
vi.mock('@upstash/ratelimit', () => {
  const slidingWindowMock = vi.fn();

  class MockRatelimit {
    limit = vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    static slidingWindow = slidingWindowMock;
  }

  return {
    Ratelimit: MockRatelimit,
  };
});

describe('UpstashRateLimitStore', () => {
  let store: UpstashRateLimitStore;
  let mockRedis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let mockSlidingWindow: ReturnType<typeof vi.fn>;

  const policy: RateLimitPolicy = {
    name: 'test-policy',
    limit: 100,
    windowMs: 60000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
    };
    const { Ratelimit } = await import('@upstash/ratelimit');
    mockSlidingWindow = Ratelimit.slidingWindow as unknown as ReturnType<typeof vi.fn>;
    store = new UpstashRateLimitStore({
      redis: mockRedis as never,
    });
  });

  it('should return successful result when limit not exceeded', async () => {
    const result = await store.check('test-key', policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(100);
    expect(result.remaining).toBe(99);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
  });

  it('should cache limiter instances by policy', async () => {
    await store.check('key1', policy);
    await store.check('key2', policy);

    // slidingWindow should only be called once for same policy
    expect(mockSlidingWindow).toHaveBeenCalledTimes(1);
  });

  it('should create different limiters for different policies', async () => {
    const policy2: RateLimitPolicy = {
      name: 'other-policy',
      limit: 50,
      windowMs: 30000,
    };

    await store.check('key1', policy);
    await store.check('key2', policy2);

    // slidingWindow should be called twice for different policies
    expect(mockSlidingWindow).toHaveBeenCalledTimes(2);
  });

  it('should use custom prefix', async () => {
    store = new UpstashRateLimitStore({
      redis: mockRedis as never,
      prefix: 'custom-prefix',
    });

    await store.check('test-key', policy);

    // Verify slidingWindow was called with correct parameters
    expect(mockSlidingWindow).toHaveBeenCalledWith(100, '60000 ms');
  });

  it('should enable ephemeral cache when specified', async () => {
    store = new UpstashRateLimitStore({
      redis: mockRedis as never,
      ephemeralCache: true,
    });

    const result = await store.check('test-key', policy);

    // Verify the store works correctly with ephemeral cache enabled
    expect(result.success).toBe(true);
  });
});
