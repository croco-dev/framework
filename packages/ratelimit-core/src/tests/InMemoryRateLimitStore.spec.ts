import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "@croco/framework-context";
import {
  FixedWindowInMemoryStore,
  InMemoryRateLimitStore,
  SlidingWindowInMemoryStore,
  TokenBucketInMemoryStore,
} from "../libs/InMemoryRateLimitStore";
import { RateLimitPruneIntervalProblem } from "../libs/problems/RateLimitConfigProblems";
import type { DistributedRateLimitStore } from "../libs/RateLimitStore";
import type {
  FixedWindowPolicy,
  SlidingWindowPolicy,
  TokenBucketPolicy,
  RateLimitPolicy,
} from "../libs/types";

beforeEach(() => {
  Container.reset();
});

describe("InMemoryRateLimitStore", () => {
  let now: number;
  let store!: InMemoryRateLimitStore;
  const policy: SlidingWindowPolicy = {
    name: "test",
    algorithm: "sliding",
    limit: 3,
    windowMs: 60000,
  };

  beforeEach(() => {
    now = Date.parse("2026-01-01T00:00:00.000Z");
    store = new InMemoryRateLimitStore({ now: () => now, pruneIntervalMs: 0 });
  });

  afterEach(() => {
    store.close();
  });

  describe.each([SlidingWindowInMemoryStore, InMemoryRateLimitStore])(
    "%s window boundary",
    (Store) => {
      it("allows a request at the resetAtMs reported when denying", async () => {
        let now = 10_000;
        const slidingStore = new Store({ now: () => now, pruneIntervalMs: 0 });
        const boundaryPolicy: SlidingWindowPolicy = { ...policy, limit: 1, windowMs: 1000 };

        expect((await slidingStore.check("user:boundary", boundaryPolicy)).success).toBe(true);
        now = 10_999;
        const denied = await slidingStore.check("user:boundary", boundaryPolicy);
        expect(denied.success).toBe(false);
        expect(denied.resetAtMs).toBe(11_000);

        now = denied.resetAtMs;
        const atReset = await slidingStore.check("user:boundary", boundaryPolicy);
        expect(atReset.success).toBe(true);
        expect(atReset.remaining).toBe(0);
        expect(atReset.resetAtMs).toBe(12_000);
        expect((await slidingStore.check("user:boundary", boundaryPolicy)).success).toBe(false);
        slidingStore.close();
      });

      it("does not refund an expired receipt at the window boundary", async () => {
        let now = 10_000;
        const slidingStore = new Store({ now: () => now, pruneIntervalMs: 0 });
        const boundaryPolicy: SlidingWindowPolicy = { ...policy, limit: 2, windowMs: 1000 };
        const expired = await slidingStore.check("user:boundary", boundaryPolicy);
        now = 10_001;
        const active = await slidingStore.check("user:boundary", boundaryPolicy);

        now = 11_000;
        const refund = await slidingStore.refund(
          "user:boundary",
          boundaryPolicy,
          expired.refundReceipt,
        );
        expect(refund.refunded).toBe(false);
        expect(refund.remaining).toBe(1);
        expect(refund.resetAtMs).toBe(11_001);
        expect(await slidingStore.getStats()).toEqual({ allowed: 2, denied: 0, total: 2 });
        expect(
          (await slidingStore.refund("user:boundary", boundaryPolicy, active.refundReceipt))
            .refunded,
        ).toBe(true);
        slidingStore.close();
      });

      it("prunes timestamps at the window boundary while retaining newer requests", async () => {
        let now = 10_000;
        const slidingStore = new Store({ now: () => now, pruneIntervalMs: 0 });
        const boundaryPolicy: SlidingWindowPolicy = { ...policy, limit: 2, windowMs: 1000 };
        await slidingStore.check("user:boundary", boundaryPolicy);
        now = 10_001;
        await slidingStore.check("user:boundary", boundaryPolicy);

        now = 10_999;
        expect(await slidingStore.pruneExpired()).toBe(0);
        now = 11_000;
        expect(await slidingStore.pruneExpired()).toBe(1);
        expect(await slidingStore.pruneExpired()).toBe(0);
        now = 11_001;
        expect(await slidingStore.pruneExpired()).toBe(1);
        slidingStore.close();
      });
    },
  );

  it("reads only timestamps strictly after the sliding window start", async () => {
    class ReadableSlidingWindowStore extends SlidingWindowInMemoryStore {
      readTimestamps(key: string, since: number): Promise<number[]> {
        return this.getTimestamps(key, since);
      }
    }
    let now = 10_000;
    const slidingStore = new ReadableSlidingWindowStore({ now: () => now, pruneIntervalMs: 0 });
    await slidingStore.check("user:boundary", policy);
    now = 10_001;
    await slidingStore.check("user:boundary", policy);

    expect(await slidingStore.readTimestamps("user:boundary", 9999)).toEqual([10_000, 10_001]);
    expect(await slidingStore.readTimestamps("user:boundary", 10_000)).toEqual([10_001]);
    expect(await slidingStore.readTimestamps("user:boundary", 10_001)).toEqual([]);
    slidingStore.close();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "rejects unsupported native prune intervals (%s) with a stable Problem",
    (pruneIntervalMs) => {
      expect(() => new InMemoryRateLimitStore({ pruneIntervalMs })).toThrow(
        RateLimitPruneIntervalProblem,
      );
    },
  );

  describe.each([FixedWindowInMemoryStore, SlidingWindowInMemoryStore, TokenBucketInMemoryStore])(
    "%s native pruning contract",
    (Store) => {
      it.each([NaN, Infinity, 2_147_483_648])(
        "never schedules rejected active interval %s",
        (pruneIntervalMs) => {
          const timer = vi.spyOn(globalThis, "setTimeout");
          try {
            expect(() => new Store({ pruneIntervalMs })).toThrow(RateLimitPruneIntervalProblem);
            expect(timer).not.toHaveBeenCalled();
          } finally {
            timer.mockRestore();
          }
        },
      );
      it.each([0, -1, -Infinity])("keeps pruning disabled for %s", (pruneIntervalMs) => {
        const schedule = vi.fn();
        const store = new Store({ pruneIntervalMs, scheduler: { schedule } });
        expect(schedule).not.toHaveBeenCalled();
        store.close();
      });
      it.each([NaN, Infinity, 2_147_483_648, 0.5])(
        "leaves custom scheduler interval %s unchanged",
        (pruneIntervalMs) => {
          const cancel = vi.fn();
          const schedule = vi.fn(() => cancel);
          const store = new Store({ pruneIntervalMs, scheduler: { schedule } });
          expect(schedule).toHaveBeenCalledWith(expect.any(Function), pruneIntervalMs);
          store.close();
          expect(cancel).toHaveBeenCalledOnce();
        },
      );
    },
  );

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
    expect(result.resetAtMs).toBeGreaterThan(now);
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
    expect(result.resetAtMs).toBe(now + 60000);
  });

  it("should reset all buckets when reset() is called", async () => {
    for (let i = 0; i < policy.limit; i++) {
      await store.check("", policy);
      await store.check("user:1", policy);
    }

    await store.reset();

    const emptyKeyResult = await store.check("", policy);
    const namedKeyResult = await store.check("user:1", policy);
    expect(emptyKeyResult.remaining).toBe(2);
    expect(namedKeyResult.remaining).toBe(2);
  });

  it('should reset only the empty-string bucket when reset("") is called', async () => {
    for (let i = 0; i < policy.limit; i++) {
      await store.check("", policy);
      await store.check("user:1", policy);
    }

    await store.reset("");

    const emptyKeyResult = await store.check("", policy);
    const namedKeyResult = await store.check("user:1", policy);
    expect(emptyKeyResult.success).toBe(true);
    expect(namedKeyResult.success).toBe(false);
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
    const first = await store.check("user:1", policy);
    now += 1;
    const second = await store.check("user:1", policy);

    const firstRefund = await store.refund("user:1", policy, first.refundReceipt);
    const secondRefund = await store.refund("user:1", policy, second.refundReceipt);

    expect(firstRefund.refunded).toBe(true);
    expect(secondRefund.refunded).toBe(true);
    expect(secondRefund.remaining).toBe(3);
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should prune expired buckets without new checks", async () => {
    await store.check("user:1", policy);
    await store.check("user:2", policy);

    now += policy.windowMs + 1;

    const deleted = await store.pruneExpired();
    const result = await store.check("user:1", policy);

    expect(deleted).toBe(2);
    expect(result.remaining).toBe(2);
  });

  it("should automatically prune expired sliding window entries", async () => {
    // Exercise the native prune timer adapter; bucket expiry uses the injected fixture clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const autoPrunedStore = new InMemoryRateLimitStore({ now: () => now, pruneIntervalMs: 10 });

    await autoPrunedStore.check("user:1", policy);
    now += policy.windowMs + 10;
    vi.advanceTimersByTime(policy.windowMs + 10);
    await vi.runOnlyPendingTimersAsync();

    const result = await autoPrunedStore.check("user:1", policy);

    expect(result.remaining).toBe(2);

    autoPrunedStore.close();
    vi.useRealTimers();
  });

  it("should clear the sliding window prune timer on destroy", () => {
    // Exercise the native prune timer adapter; bucket expiry uses the injected fixture clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const autoPrunedStore = new InMemoryRateLimitStore({ now: () => now, pruneIntervalMs: 10 });

    autoPrunedStore.destroy();

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  describe("FixedWindowInMemoryStore counters", () => {
    let fixedStore!: FixedWindowInMemoryStore;
    let now: number;
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-counter",
      algorithm: "fixed",
      limit: 10,
      windowMs: 1000,
    };

    beforeEach(() => {
      now = 0;
      fixedStore = new FixedWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });
    });

    afterEach(() => {
      fixedStore.close();
    });

    it.each([5, 0, 1.5, -2])("should persist a new key's increment of %s", async (amount) => {
      expect(await fixedStore.getCount("user:counter")).toBe(0);
      expect(await fixedStore.increment("user:counter", amount)).toBe(amount);
      expect(await fixedStore.getCount("user:counter")).toBe(amount);
      expect(await fixedStore.increment("user:counter")).toBe(amount + 1);
      expect(await fixedStore.getCount("user:counter")).toBe(amount + 1);
      expect(await fixedStore.getCount("user:other")).toBe(0);
      expect(await fixedStore.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
    });

    it("should reset only the requested counter and start its next increment from zero", async () => {
      await fixedStore.increment("", 5);
      await fixedStore.increment("user:other", 2);

      await fixedStore.reset("");

      expect(await fixedStore.getCount("")).toBe(0);
      expect(await fixedStore.getCount("user:other")).toBe(2);
      expect(await fixedStore.increment("")).toBe(1);
    });

    it("should accumulate concurrent standalone increments without losing updates", async () => {
      const counts = await Promise.all(
        Array.from({ length: 20 }, () => fixedStore.increment("user:counter")),
      );

      expect(counts).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
      expect(await fixedStore.getCount("user:counter")).toBe(20);
    });

    it("should retain a standalone counter's TTL across increments and expire reads at its boundary", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.expire("user:counter", 100);
      now = 99;

      expect(await fixedStore.increment("user:counter", 2)).toBe(7);
      expect(await fixedStore.getCount("user:counter")).toBe(7);
      now = 100;

      expect(await fixedStore.getCount("user:counter")).toBe(0);
      expect(await fixedStore.pruneExpired()).toBe(0);
    });

    it("should restart an expired standalone counter on increment without a preceding read", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.expire("user:counter", 100);
      now = 100;

      expect(await fixedStore.increment("user:counter", 2)).toBe(2);
      expect(await fixedStore.getCount("user:counter")).toBe(2);
    });

    it("should prune expired standalone counters alongside windows while retaining active counters", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.expire("user:counter", 100);
      await fixedStore.increment("user:active", 2);
      await fixedStore.check("user:window", fixedPolicy);
      now = 1001;

      expect(await fixedStore.pruneExpired()).toBe(2);
      expect(await fixedStore.getCount("user:counter")).toBe(0);
      expect(await fixedStore.getCount("user:window")).toBe(0);
      expect(await fixedStore.getCount("user:active")).toBe(2);
    });

    it.each([0, -1])(
      "should immediately expire only the standalone counter for TTL %s",
      async (ttlMs) => {
        await fixedStore.increment("user:counter", 5);
        await fixedStore.check("user:window", fixedPolicy);

        await fixedStore.expire("user:counter", ttlMs);
        await fixedStore.expire("user:window", ttlMs);

        expect(await fixedStore.getCount("user:counter")).toBe(0);
        expect(await fixedStore.getCount("user:window")).toBe(1);
      },
    );

    it("should clear TTL state on reset and avoid expiring a counter that did not exist", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.expire("user:counter", 100);
      await fixedStore.reset("user:counter");
      await fixedStore.increment("user:counter", 2);
      await fixedStore.expire("user:missing", 100);
      await fixedStore.increment("user:missing", 3);
      now = 100;

      expect(await fixedStore.getCount("user:counter")).toBe(2);
      expect(await fixedStore.getCount("user:missing")).toBe(3);
    });

    it("should continue incrementing and resetting existing policy windows", async () => {
      await fixedStore.check("user:window", fixedPolicy);

      expect(await fixedStore.increment("user:window", 5)).toBe(6);
      expect(await fixedStore.getCount("user:window")).toBe(6);
      expect((await fixedStore.check("user:window", fixedPolicy)).remaining).toBe(3);

      await fixedStore.reset("user:window");

      expect(await fixedStore.getCount("user:window")).toBe(0);
      expect(await fixedStore.increment("user:window", 2)).toBe(2);
      expect(await fixedStore.getCount("user:window")).toBe(2);
    });

    it("should keep standalone counters when pruning unrelated policy windows", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.check("user:window", fixedPolicy);
      now = 1001;

      expect(await fixedStore.pruneExpired()).toBe(1);
      expect(await fixedStore.getCount("user:counter")).toBe(5);
      expect(await fixedStore.getCount("user:window")).toBe(0);
    });

    it("should replace a standalone counter with a policy window without restoring it after pruning", async () => {
      await fixedStore.increment("user:counter", 5);
      await fixedStore.expire("user:counter", 100);

      expect((await fixedStore.check("user:counter", fixedPolicy)).remaining).toBe(9);
      expect(await fixedStore.increment("user:counter", 2)).toBe(3);
      now = 100;
      expect(await fixedStore.getCount("user:counter")).toBe(3);
      now = 1001;

      expect(await fixedStore.pruneExpired()).toBe(1);
      expect(await fixedStore.getCount("user:counter")).toBe(0);
      expect(await fixedStore.increment("user:counter")).toBe(1);
    });
  });

  it("should automatically prune expired fixed window entries", async () => {
    // Exercise the native prune timer adapter; bucket expiry uses the injected fixture clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-test",
      algorithm: "fixed",
      limit: 3,
      windowMs: 60000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ now: () => now, pruneIntervalMs: 10 });

    await fixedStore.check("user:1", fixedPolicy);
    now += fixedPolicy.windowMs + 10;
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
    const fixedStore = new FixedWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

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

  it("should preserve other fixed-window refund receipts when resetting the empty-string key", async () => {
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-empty-reset",
      algorithm: "fixed",
      limit: 1,
      windowMs: 60000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    const check = await fixedStore.check("user:1", fixedPolicy);
    await fixedStore.reset("");
    const refund = await fixedStore.refund("user:1", fixedPolicy, check.refundReceipt);

    expect(refund.refunded).toBe(true);

    fixedStore.close();
  });

  it("should not refund a stale fixed window receipt into a newer window", async () => {
    const fixedPolicy: FixedWindowPolicy = {
      name: "fixed-stale-refund",
      algorithm: "fixed",
      limit: 1,
      windowMs: 1000,
    };
    const fixedStore = new FixedWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    const staleCheck = await fixedStore.check("user:1", fixedPolicy);
    now += 1001;
    const currentCheck = await fixedStore.check("user:1", fixedPolicy);
    const staleRefund = await fixedStore.refund("user:1", fixedPolicy, staleCheck.refundReceipt);
    const blocked = await fixedStore.check("user:1", fixedPolicy);

    expect(currentCheck.success).toBe(true);
    expect(staleRefund.refunded).toBe(false);
    expect(blocked.success).toBe(false);
    expect(await fixedStore.getStats()).toEqual({ allowed: 2, denied: 1, total: 3 });

    fixedStore.close();
  });

  it("should automatically prune expired token bucket entries", async () => {
    // Exercise the native prune timer adapter; bucket expiry uses the injected fixture clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-test",
      algorithm: "token-bucket",
      capacity: 3,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 10 });

    await tokenStore.check("user:1", tokenPolicy);
    now += 3010;
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
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

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

  it("should preserve fractional refill time while the token bucket is below capacity", async () => {
    let now = 0;
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-fractional-refill",
      algorithm: "token-bucket",
      capacity: 2,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    const initialResults = [
      await tokenStore.check("user:fractional", tokenPolicy),
      await tokenStore.check("user:fractional", tokenPolicy),
    ];

    now = 1500;
    const firstRefill = await tokenStore.check("user:fractional", tokenPolicy);

    now = 2000;
    const secondRefill = await tokenStore.check("user:fractional", tokenPolicy);

    expect(initialResults.map((result) => result.success)).toEqual([true, true]);
    expect(firstRefill.success).toBe(true);
    expect(firstRefill.resetAtMs).toBe(2000);
    expect(secondRefill.success).toBe(true);

    tokenStore.close();
  });

  it("should discard refill time accumulated while the token bucket is full", async () => {
    let now = 0;
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-full-boundary",
      algorithm: "token-bucket",
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    const initial = await tokenStore.check("user:full", tokenPolicy);
    await tokenStore.refund("user:full", tokenPolicy, initial.refundReceipt);

    now = 500;
    const consumedFromFullBucket = await tokenStore.check("user:full", tokenPolicy);

    now = 1000;
    const earlyRetry = await tokenStore.check("user:full", tokenPolicy);

    now = 1500;
    const refilledRetry = await tokenStore.check("user:full", tokenPolicy);

    expect(consumedFromFullBucket.success).toBe(true);
    expect(earlyRetry.success).toBe(false);
    expect(refilledRetry.success).toBe(true);

    tokenStore.close();
  });

  it("should preserve fractional refill time through token bucket refunds", async () => {
    let now = 0;
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-refund-fractional-refill",
      algorithm: "token-bucket",
      capacity: 4,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });
    const refundableCheck = await tokenStore.check("user:refund-fractional", tokenPolicy);

    for (let index = 1; index < tokenPolicy.capacity; index++) {
      await tokenStore.check("user:refund-fractional", tokenPolicy);
    }

    now = 1500;
    const refund = await tokenStore.refund(
      "user:refund-fractional",
      tokenPolicy,
      refundableCheck.refundReceipt,
    );

    now = 2000;
    const checkAfterRefund = await tokenStore.check("user:refund-fractional", tokenPolicy);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(2);
    expect(checkAfterRefund.success).toBe(true);
    expect(checkAfterRefund.remaining).toBe(2);

    tokenStore.close();
  });

  it("should preserve other token-bucket refund receipts when resetting the empty-string key", async () => {
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-empty-reset",
      algorithm: "token-bucket",
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    const check = await tokenStore.check("user:1", tokenPolicy);
    await tokenStore.reset("");
    const refund = await tokenStore.refund("user:1", tokenPolicy, check.refundReceipt);

    expect(refund.refunded).toBe(true);

    tokenStore.close();
  });

  it("should persist sliding-window counters independently from request quota", async () => {
    let now = 0;
    const slidingStore = new SlidingWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    expect(await slidingStore.getCount("user:counter")).toBe(0);
    expect(await slidingStore.increment("user:counter")).toBe(1);
    expect(await slidingStore.increment("user:counter", 1.5)).toBe(2.5);
    expect(await slidingStore.increment("user:counter", -0.25)).toBe(2.25);
    expect(await slidingStore.getCount("user:other")).toBe(0);

    const result = await slidingStore.check("user:counter", policy);

    expect(result.remaining).toBe(2);
    expect(await slidingStore.getCount("user:counter")).toBe(2.25);
    expect(await slidingStore.getStats()).toEqual({ allowed: 1, denied: 0, total: 1 });

    await slidingStore.expire("user:counter", 5000);

    now = 4999;
    expect(await slidingStore.increment("user:counter", 0.5)).toBe(2.75);
    expect(await slidingStore.getCount("user:counter")).toBe(2.75);

    now = 5000;
    expect(await slidingStore.getCount("user:counter")).toBe(0);

    await slidingStore.increment("user:counter", 4);
    await slidingStore.reset("user:counter");

    expect(await slidingStore.getCount("user:counter")).toBe(0);

    slidingStore.close();
  });

  it("should persist token-bucket counters independently from request quota", async () => {
    let now = 0;
    const tokenPolicy: TokenBucketPolicy = {
      name: "token-counter",
      algorithm: "token-bucket",
      capacity: 3,
      refillRate: 1,
      refillIntervalMs: 1000,
    };
    const tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });

    expect(await tokenStore.getCount("user:counter")).toBe(0);
    expect(await tokenStore.increment("user:counter")).toBe(1);
    expect(await tokenStore.increment("user:counter", 2.25)).toBe(3.25);
    expect(await tokenStore.increment("user:counter", -0.5)).toBe(2.75);
    expect(await tokenStore.getCount("user:other")).toBe(0);

    const result = await tokenStore.check("user:counter", tokenPolicy);

    expect(result.remaining).toBe(2);
    expect(await tokenStore.getCount("user:counter")).toBe(2.75);
    expect(await tokenStore.getStats()).toEqual({ allowed: 1, denied: 0, total: 1 });

    await tokenStore.expire("user:counter", 5000);

    now = 4999;
    expect(await tokenStore.increment("user:counter", 0.5)).toBe(3.25);
    expect(await tokenStore.getCount("user:counter")).toBe(3.25);

    now = 5000;
    expect(await tokenStore.getCount("user:counter")).toBe(0);

    await tokenStore.increment("user:counter", 4);
    await tokenStore.reset("user:counter");

    expect(await tokenStore.getCount("user:counter")).toBe(0);

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
      slidingStore = new SlidingWindowInMemoryStore({ now: () => now, pruneIntervalMs: 0 });
    });

    afterEach(() => {
      slidingStore.close();
    });

    it("should use custom windowMs (5000ms) for pruning", async () => {
      // Make 5 requests within the custom 5000ms window
      for (let i = 0; i < 5; i++) {
        const r = await slidingStore.check("key-a", customWindowPolicy);
        expect(r.success).toBe(true);
      }

      // Advance past 5000ms custom window but still within default 60000ms
      now += 6000;

      // pruneExpired uses stored entry.windowMs — with bug (60000) nothing pruned,
      // with fix (5000) all 5 entries get pruned
      const deleted = await slidingStore.pruneExpired();
      expect(deleted).toBe(5);

      // After prune, fresh entry with full capacity
      const result = await slidingStore.check("key-a", customWindowPolicy);
      expect(result.remaining).toBe(4);
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
      tokenStore = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });
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

describe.each([
  {
    name: "fixed",
    create: (now: () => number, beforeRead: (key: string) => Promise<void> = async () => {}) =>
      new (class extends FixedWindowInMemoryStore {
        protected async getWindowEntry(key: string, policy: FixedWindowPolicy) {
          await beforeRead(key);
          return super.getWindowEntry(key, policy);
        }
      })({ now, pruneIntervalMs: 0 }),
    policy: { name: "concurrent", algorithm: "fixed", limit: 3, windowMs: 1000 },
  },
  {
    name: "sliding",
    create: (now: () => number, beforeRead: (key: string) => Promise<void> = async () => {}) =>
      new (class extends SlidingWindowInMemoryStore {
        protected async removeTimestamps(key: string, before: number) {
          await beforeRead(key);
          return super.removeTimestamps(key, before);
        }
      })({ now, pruneIntervalMs: 0 }),
    policy: { name: "concurrent", algorithm: "sliding", limit: 3, windowMs: 1000 },
  },
  {
    name: "token-bucket",
    create: (now: () => number, beforeRead: (key: string) => Promise<void> = async () => {}) =>
      new (class extends TokenBucketInMemoryStore {
        protected async getBucket(key: string) {
          await beforeRead(key);
          return super.getBucket(key);
        }
      })({ now, pruneIntervalMs: 0 }),
    policy: {
      name: "concurrent",
      algorithm: "token-bucket",
      capacity: 3,
      refillRate: 3,
      refillIntervalMs: 1000,
    },
  },
] satisfies Array<{
  name: string;
  create: (
    now: () => number,
    beforeRead?: (key: string) => Promise<void>,
  ) => DistributedRateLimitStore;
  policy: RateLimitPolicy;
}>)("$name concurrent admission", ({ create, policy }) => {
  function setup() {
    let now = 10_000;
    const store: DistributedRateLimitStore = create(() => now);
    return {
      store,
      advance: () => {
        now += 1000;
      },
    };
  }

  it.each([0, 2])("admits only remaining quota after %i prior requests", async (used) => {
    const { store, advance } = setup();
    for (let i = 0; i < used; i++) await store.check("key", policy);
    const results = await Promise.all(Array.from({ length: 10 }, () => store.check("key", policy)));
    expect(results.filter((result) => result.success)).toHaveLength(3 - used);
    expect(results.filter((result) => result.success).map((result) => result.remaining)).toEqual(
      Array.from({ length: 3 - used }, (_, i) => 2 - used - i),
    );
    expect((await store.check("key", policy)).success).toBe(false);
    advance();
    const renewed = await Promise.all(Array.from({ length: 5 }, () => store.check("key", policy)));
    expect(renewed.filter((result) => result.success)).toHaveLength(3);
  });

  it("consumes a receipt once before admitting only the refunded capacity", async () => {
    const { store } = setup();
    const first = await store.check("key", policy);
    await store.check("key", policy);
    await store.check("key", policy);
    const refunds = Array.from({ length: 5 }, () =>
      store.refund("key", policy, first.refundReceipt),
    );
    const checks = Array.from({ length: 5 }, () => store.check("key", policy));
    expect((await Promise.all(refunds)).filter((result) => result.refunded)).toHaveLength(1);
    expect((await Promise.all(checks)).filter((result) => result.success)).toHaveLength(1);
    expect((await store.check("key", policy)).remaining).toBe(0);
  });

  it("orders reset after pending admission and invalidates its receipt", async () => {
    const { store } = setup();
    const pending = store.check("key", policy);
    const reset = store.reset("key");
    const afterReset = Array.from({ length: 5 }, () => store.check("key", policy));
    const prior = await pending;
    await reset;
    expect((await Promise.all(afterReset)).filter((result) => result.success)).toHaveLength(3);
    expect((await store.refund("key", policy, prior.refundReceipt)).refunded).toBe(false);
    expect((await store.check("key", policy)).success).toBe(false);
  });

  it("does not resurrect pre-reset quota or receipts when refund is already pending", async () => {
    const { store } = setup();
    const first = await store.check("key", policy);
    const second = await store.check("key", policy);
    await store.check("key", policy);
    const refund = store.refund("key", policy, first.refundReceipt);
    const reset = store.reset("key");
    const checks = Array.from({ length: 5 }, () => store.check("key", policy));
    await refund;
    await reset;
    expect((await Promise.all(checks)).filter((result) => result.success)).toHaveLength(3);
    expect((await store.refund("key", policy, second.refundReceipt)).refunded).toBe(false);
    expect((await store.check("key", policy)).success).toBe(false);
  });

  it("keeps another key moving while one admission is suspended", async () => {
    let signalStarted = () => {};
    let releaseRead = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const store: DistributedRateLimitStore = create(
      () => 10_000,
      async (key) => {
        if (key === "slow") {
          signalStarted();
          await release;
        }
      },
    );
    const slow = store.check("slow", policy);
    await started;
    try {
      const fast = await store.check("fast", policy);
      expect(fast.success).toBe(true);
      expect(fast.remaining).toBe(2);
    } finally {
      releaseRead();
      await slow;
    }
  });

  it("adds idle and queued pruning counts after a pending operation crosses expiry", async () => {
    let now = 10_000;
    let pauseBusy = false;
    let signalStarted = () => {};
    let releaseRead = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const store: DistributedRateLimitStore = create(
      () => now,
      async (key) => {
        if (key === "busy" && pauseBusy) {
          pauseBusy = false;
          signalStarted();
          await release;
        }
      },
    );
    await store.check("idle", policy);
    await store.check("busy", policy);
    pauseBusy = true;
    const pending = store.check("busy", policy);
    await started;
    now = 12_001;
    const pruning = store.pruneExpired();
    releaseRead();
    const oldAdmission = await pending;
    expect(await pruning).toBe(policy.algorithm === "sliding" ? 3 : 2);
    expect((await store.refund("busy", policy, oldAdmission.refundReceipt)).refunded).toBe(false);
    expect((await store.check("idle", policy)).remaining).toBe(2);
    expect((await store.check("busy", policy)).remaining).toBe(2);
  });

  it("recovers the key queue after a rejected policy", async () => {
    const { store } = setup();
    const invalid =
      policy.algorithm === "token-bucket" ? { ...policy, capacity: 0 } : { ...policy, limit: 0 };
    const rejected = store.check("key", invalid);
    const valid = store.check("key", policy);
    await expect(rejected).rejects.toMatchObject({ code: "ratelimit/invalid-policy" });
    expect((await valid).remaining).toBe(2);
  });

  it("orders pruning after pending admission without deleting active quota", async () => {
    const { store } = setup();
    const checks = Array.from({ length: 5 }, () => store.check("key", policy));
    const pruned = store.pruneExpired();
    expect((await Promise.all(checks)).filter((result) => result.success)).toHaveLength(3);
    expect(await pruned).toBe(0);
    expect((await store.check("key", policy)).success).toBe(false);
  });

  it("serializes the public algorithm entrypoint with ordinary admission", async () => {
    const store: DistributedRateLimitStore = create(() => 10_000);
    const direct = () => {
      if (store instanceof FixedWindowInMemoryStore && policy.algorithm === "fixed")
        return store.checkFixedWindow("key", policy);
      if (store instanceof SlidingWindowInMemoryStore && policy.algorithm === "sliding")
        return store.checkSlidingWindow("key", policy);
      if (store instanceof TokenBucketInMemoryStore && policy.algorithm === "token-bucket")
        return store.checkTokenBucket("key", policy);
      throw new Error("fixture algorithm mismatch");
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => (index % 2 ? direct() : store.check("key", policy))),
    );
    expect(results.filter((result) => result.success)).toHaveLength(3);
  });

  it("finishes a last-unit refund without blocking later requests", async () => {
    const { store } = setup();
    const first = await store.check("key", policy);
    expect((await store.refund("key", policy, first.refundReceipt)).refunded).toBe(true);
    const results = await Promise.all(Array.from({ length: 5 }, () => store.check("key", policy)));
    expect(results.filter((result) => result.success)).toHaveLength(3);
  });
});

it("resets all sliding keys including an admission that has not stored its first timestamp", async () => {
  const store = new SlidingWindowInMemoryStore({ now: () => 10_000, pruneIntervalMs: 0 });
  const policy: SlidingWindowPolicy = {
    name: "all",
    algorithm: "sliding",
    limit: 1,
    windowMs: 1000,
  };
  const before = store.check("new-key", policy);
  const reset = store.reset();
  const after = store.check("new-key", policy);
  const receipt = (await before).refundReceipt;
  await reset;
  expect((await after).success).toBe(true);
  expect((await store.refund("new-key", policy, receipt)).refunded).toBe(false);
  expect((await store.check("new-key", policy)).success).toBe(false);
});

it("expires a token bucket after pending admission without reviving its receipt", async () => {
  const store = new TokenBucketInMemoryStore({ now: () => 10_000, pruneIntervalMs: 0 });
  const policy: TokenBucketPolicy = {
    name: "expire",
    algorithm: "token-bucket",
    capacity: 1,
    refillRate: 1,
    refillIntervalMs: 1000,
  };
  const before = store.check("key", policy);
  const expired = store.expire("key", 0);
  const after = store.check("key", policy);
  const receipt = (await before).refundReceipt;
  await expired;
  expect((await after).success).toBe(true);
  expect((await store.refund("key", policy, receipt)).refunded).toBe(false);
  expect((await store.check("key", policy)).success).toBe(false);
});
