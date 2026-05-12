import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FixedWindowInMemoryStore,
  InMemoryRateLimitStore,
  TokenBucketInMemoryStore,
} from "../libs/InMemoryRateLimitStore";
import type { FixedWindowPolicy, SlidingWindowPolicy, TokenBucketPolicy } from "../libs/types";

describe("InMemoryRateLimitStore", () => {
  let store!: InMemoryRateLimitStore;
  const policy: SlidingWindowPolicy = {
    name: "test",
    algorithm: "sliding",
    limit: 3,
    windowMs: 60000,
  };

  beforeEach(() => {
    store = new InMemoryRateLimitStore({ pruneIntervalMs: 0 });
  });

  afterEach(() => {
    store.close();
  });

  it("should allow requests within limit", async () => {
    const result1 = await store.check("user:1", policy);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = await store.check("user:1", policy);
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = await store.check("user:1", policy);
    expect(result3.success).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it("should reject requests exceeding limit", async () => {
    await store.check("user:1", policy);
    await store.check("user:1", policy);
    await store.check("user:1", policy);

    const result = await store.check("user:1", policy);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
  });

  it("should track different keys separately", async () => {
    await store.check("user:1", policy);
    await store.check("user:1", policy);
    await store.check("user:1", policy);

    const result = await store.check("user:2", policy);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should return correct limit and resetAtMs", async () => {
    const result = await store.check("user:1", policy);
    expect(result.limit).toBe(3);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
    expect(result.resetAtMs).toBeLessThanOrEqual(Date.now() + 60000);
  });

  it("should reset buckets when reset() is called", async () => {
    await store.check("user:1", policy);
    await store.check("user:1", policy);

    store.reset();

    const result = await store.check("user:1", policy);
    expect(result.remaining).toBe(2);
  });

  it("should prune expired buckets without new checks", async () => {
    vi.useFakeTimers();

    await store.check("user:1", policy);
    await store.check("user:2", policy);

    vi.advanceTimersByTime(policy.windowMs + 1);

    const deleted = await store.pruneExpired();
    const result = await store.check("user:1", policy);

    expect(deleted).toBe(2);
    expect(result.remaining).toBe(2);

    vi.useRealTimers();
  });

  it("should automatically prune expired sliding window entries", async () => {
    vi.useFakeTimers();
    const autoPrunedStore = new InMemoryRateLimitStore({ pruneIntervalMs: 10 });

    await autoPrunedStore.check("user:1", policy);
    vi.advanceTimersByTime(policy.windowMs + 10);
    await vi.runOnlyPendingTimersAsync();

    const result = await autoPrunedStore.check("user:1", policy);

    expect(result.remaining).toBe(2);

    autoPrunedStore.close();
    vi.useRealTimers();
  });

  it("should clear the sliding window prune timer on destroy", () => {
    vi.useFakeTimers();
    const autoPrunedStore = new InMemoryRateLimitStore({ pruneIntervalMs: 10 });

    autoPrunedStore.destroy();

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("should automatically prune expired fixed window entries", async () => {
    vi.useFakeTimers();
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-test",
      algorithm: "fixed",
      limit: 3,
      windowMs: 60000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ pruneIntervalMs: 10 });

    await fixedStore.check("user:1", fixedPolicy);
    vi.advanceTimersByTime(fixedPolicy.windowMs + 10);
    await vi.runOnlyPendingTimersAsync();

    const result = await fixedStore.check("user:1", fixedPolicy);

    expect(result.remaining).toBe(2);

    fixedStore.close();
    vi.useRealTimers();
  });

  it("should automatically prune expired token bucket entries", async () => {
    vi.useFakeTimers();
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-test",
      algorithm: "token-bucket",
      capacity: 3,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ pruneIntervalMs: 10 });

    await tokenStore.check("user:1", tokenPolicy);
    vi.advanceTimersByTime(3010);
    await vi.runOnlyPendingTimersAsync();

    const deleted = await tokenStore.pruneExpired();

    expect(deleted).toBe(0);
    expect(await tokenStore.getStats()).toEqual({ allowed: 1, denied: 0, total: 1 });

    tokenStore.close();
    vi.useRealTimers();
  });
});
