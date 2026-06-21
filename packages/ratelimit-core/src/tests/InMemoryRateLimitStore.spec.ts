import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FixedWindowInMemoryStore,
  InMemoryRateLimitStore,
  SlidingWindowInMemoryStore,
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

  it("should refund sliding window quota and stats", async () => {
    const check = await store.check("user:1", policy);

    const refund = await store.refund("user:1", policy, check.refundReceipt);
    const duplicateRefund = await store.refund("user:1", policy, check.refundReceipt);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(3);
    expect(duplicateRefund.refunded).toBe(false);
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });

    const result = await store.check("user:1", policy);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should refund the original sliding window receipt for out-of-order completions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const first = await store.check("user:1", policy);
    vi.advanceTimersByTime(1);
    const second = await store.check("user:1", policy);

    const firstRefund = await store.refund("user:1", policy, first.refundReceipt);
    const secondRefund = await store.refund("user:1", policy, second.refundReceipt);

    expect(firstRefund.refunded).toBe(true);
    expect(secondRefund.refunded).toBe(true);
    expect(secondRefund.remaining).toBe(3);
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });

    vi.useRealTimers();
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

  it("should refund fixed window quota and stats", async () => {
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-refund",
      algorithm: "fixed",
      limit: 1,
      windowMs: 60000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ pruneIntervalMs: 0 });

    const check = await fixedStore.check("user:1", fixedPolicy);
    const refund = await fixedStore.refund("user:1", fixedPolicy, check.refundReceipt);
    const duplicateRefund = await fixedStore.refund("user:1", fixedPolicy, check.refundReceipt);
    const result = await fixedStore.check("user:1", fixedPolicy);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(1);
    expect(duplicateRefund.refunded).toBe(false);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
    expect(await fixedStore.getStats()).toEqual({ allowed: 1, denied: 0, total: 1 });

    fixedStore.close();
  });

  it("should not refund a stale fixed window receipt into a newer window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-stale-refund",
      algorithm: "fixed",
      limit: 1,
      windowMs: 1000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ pruneIntervalMs: 0 });

    const staleCheck = await fixedStore.check("user:1", fixedPolicy);
    vi.advanceTimersByTime(1001);
    const currentCheck = await fixedStore.check("user:1", fixedPolicy);
    const staleRefund = await fixedStore.refund("user:1", fixedPolicy, staleCheck.refundReceipt);
    const blocked = await fixedStore.check("user:1", fixedPolicy);

    expect(currentCheck.success).toBe(true);
    expect(staleRefund.refunded).toBe(false);
    expect(blocked.success).toBe(false);
    expect(await fixedStore.getStats()).toEqual({ allowed: 2, denied: 1, total: 3 });

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

  it("should refund token bucket quota and stats", async () => {
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-refund",
      algorithm: "token-bucket",
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ pruneIntervalMs: 0 });

    const check = await tokenStore.check("user:1", tokenPolicy);
    const refund = await tokenStore.refund("user:1", tokenPolicy, check.refundReceipt);
    const duplicateRefund = await tokenStore.refund("user:1", tokenPolicy, check.refundReceipt);
    const result = await tokenStore.check("user:1", tokenPolicy);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(1);
    expect(duplicateRefund.refunded).toBe(false);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
    expect(await tokenStore.getStats()).toEqual({ allowed: 1, denied: 0, total: 1 });

    tokenStore.close();
  });

  describe("SlidingWindowInMemoryStore custom windowMs", () => {
    let slidingStore!: SlidingWindowInMemoryStore;
    const customWindowPolicy: SlidingWindowPolicy = {
      name: "custom-window",
      algorithm: "sliding",
      limit: 5,
      windowMs: 5000,
    };

    beforeEach(() => {
      slidingStore = new SlidingWindowInMemoryStore({ pruneIntervalMs: 0 });
    });

    afterEach(() => {
      slidingStore.close();
    });

    it("should use custom windowMs (5000ms) for pruning", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      // Make 5 requests within the custom 5000ms window
      for (let i = 0; i < 5; i++) {
        const r = await slidingStore.check("key-a", customWindowPolicy);
        expect(r.success).toBe(true);
      }

      // Advance past 5000ms custom window but still within default 60000ms
      vi.advanceTimersByTime(6000);

      // pruneExpired uses stored entry.windowMs — with bug (60000) nothing pruned,
      // with fix (5000) all 5 entries get pruned
      const deleted = await slidingStore.pruneExpired();
      expect(deleted).toBe(5);

      // After prune, fresh entry with full capacity
      const result = await slidingStore.check("key-a", customWindowPolicy);
      expect(result.remaining).toBe(4);

      vi.useRealTimers();
    });
  });

  describe("TokenBucketInMemoryStore reset and expire", () => {
    let tokenStore!: TokenBucketInMemoryStore;
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-test",
      algorithm: "token-bucket",
      capacity: 3,
      refillRate: 1,
      refillIntervalMs: 1000,
    };

    beforeEach(() => {
      tokenStore = new TokenBucketInMemoryStore({ pruneIntervalMs: 0 });
    });

    afterEach(() => {
      tokenStore.close();
    });

    it("should delete bucket on reset(key)", async () => {
      // Consume all tokens
      for (let i = 0; i < 3; i++) {
        await tokenStore.check("user:reset", tokenPolicy);
      }
      let result = await tokenStore.check("user:reset", tokenPolicy);
      expect(result.success).toBe(false);

      // Reset the key
      await tokenStore.reset("user:reset");

      // Should be a fresh bucket with full capacity
      result = await tokenStore.check("user:reset", tokenPolicy);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("should delete bucket on expire(key, ttlMs)", async () => {
      await tokenStore.check("user:expire", tokenPolicy);

      // Expire the bucket
      await tokenStore.expire("user:expire", 0);

      // After expire, next check should create a fresh bucket
      const result = await tokenStore.check("user:expire", tokenPolicy);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });
});
