import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRateLimitStore } from '../libs/InMemoryRateLimitStore';
import type { RateLimitPolicy } from '../libs/types';

describe('InMemoryRateLimitStore', () => {
  let store!: InMemoryRateLimitStore;
  const policy: RateLimitPolicy = {
    name: 'test',
    limit: 3,
    windowMs: 60000,
  };

  beforeEach(() => {
    store = new InMemoryRateLimitStore();
  });

  it('should allow requests within limit', async () => {
    const result1 = await store.check('user:1', policy);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = await store.check('user:1', policy);
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = await store.check('user:1', policy);
    expect(result3.success).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should reject requests exceeding limit', async () => {
    await store.check('user:1', policy);
    await store.check('user:1', policy);
    await store.check('user:1', policy);

    const result = await store.check('user:1', policy);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
  });

  it('should track different keys separately', async () => {
    await store.check('user:1', policy);
    await store.check('user:1', policy);
    await store.check('user:1', policy);

    const result = await store.check('user:2', policy);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should return correct limit and resetAtMs', async () => {
    const result = await store.check('user:1', policy);
    expect(result.limit).toBe(3);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
    expect(result.resetAtMs).toBeLessThanOrEqual(Date.now() + 60000);
  });

  it('should reset buckets when reset() is called', async () => {
    await store.check('user:1', policy);
    await store.check('user:1', policy);

    store.reset();

    const result = await store.check('user:1', policy);
    expect(result.remaining).toBe(2);
  });

  it('should prune expired buckets without new checks', async () => {
    vi.useFakeTimers();

    await store.check('user:1', policy);
    await store.check('user:2', policy);

    vi.advanceTimersByTime(policy.windowMs + 1);

    const deleted = await store.pruneExpired();
    const result = await store.check('user:1', policy);

    expect(deleted).toBe(2);
    expect(result.remaining).toBe(2);

    vi.useRealTimers();
  });
});
