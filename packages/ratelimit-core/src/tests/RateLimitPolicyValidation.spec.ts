import { describe, expect, it, vi } from "vitest";
import {
  FixedWindowInMemoryStore,
  SlidingWindowInMemoryStore,
  TokenBucketInMemoryStore,
} from "../libs/InMemoryRateLimitStore";
import {
  createFixedWindowPolicy,
  createSlidingWindowPolicy,
  createTokenBucketPolicy,
  RateLimiter,
} from "../libs/RateLimiter";
import { parseWindowMs } from "../libs/types";
import type { RateLimitStore } from "../libs/RateLimitStore";
import type { RateLimitPolicy } from "../libs/types";

const policies = [
  { name: "fixed", algorithm: "fixed", limit: 2, windowMs: 1000 },
  { name: "sliding", algorithm: "sliding", limit: 2, windowMs: 1000 },
  {
    name: "bucket",
    algorithm: "token-bucket",
    capacity: 2,
    refillRate: 0.5,
    refillIntervalMs: 1000,
  },
] as const;
const invalidIntegers = [NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1];
const configProblem = { code: "ratelimit/invalid-policy" };

function createStore(policy: RateLimitPolicy): RateLimitStore {
  const options = { now: () => 10_000, pruneIntervalMs: 0 };
  switch (policy.algorithm) {
    case "fixed":
      return new FixedWindowInMemoryStore(options);
    case "sliding":
      return new SlidingWindowInMemoryStore(options);
    case "token-bucket":
      return new TokenBucketInMemoryStore(options);
    default:
      return new FixedWindowInMemoryStore(options);
  }
}

describe("RateLimitPolicyValidation", () => {
  for (const policy of policies) {
    const fields =
      policy.algorithm === "token-bucket"
        ? ["capacity", "refillIntervalMs"]
        : ["limit", "windowMs"];
    for (const field of fields) {
      it.each(invalidIntegers)(
        `${policy.algorithm} rejects ${field}=%s before changing state`,
        async (value) => {
          const store = createStore(policy);
          await expect(store.check("key", { ...policy, [field]: value })).rejects.toMatchObject(
            configProblem,
          );
          expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
          expect((await store.check("key", policy)).remaining).toBe(1);
        },
      );
    }

    it(`${policy.algorithm} rejects invalid refund policy without consuming its receipt`, async () => {
      const store = createStore(policy);
      const result = await store.check("key", policy);
      const invalidPolicy =
        policy.algorithm === "token-bucket"
          ? { ...policy, refillRate: 0 }
          : { ...policy, windowMs: NaN };
      await expect(store.refund("key", invalidPolicy, result.refundReceipt)).rejects.toMatchObject(
        configProblem,
      );
      expect((await store.refund("key", policy, result.refundReceipt)).refunded).toBe(true);
    });

    it.each([true, false])(
      `${policy.algorithm} configuration errors bypass failOpen=%s`,
      async (failOpen) => {
        const store = createStore(policy);
        const check = vi.spyOn(store, "check");
        const onStoreError = vi.fn();
        const keyBuilder = vi.fn(() => "key");
        const limiter = new RateLimiter<Record<string, unknown>>(store, keyBuilder, {
          failOpen,
          onStoreError,
        });
        const invalidPolicy =
          policy.algorithm === "token-bucket"
            ? { ...policy, capacity: 0 }
            : { ...policy, limit: 0 };
        await expect(limiter.check({}, invalidPolicy)).rejects.toMatchObject(configProblem);
        await expect(limiter.checkWithKey("key", invalidPolicy)).rejects.toMatchObject(
          configProblem,
        );
        expect(check).not.toHaveBeenCalled();
        expect(keyBuilder).not.toHaveBeenCalled();
        expect(onStoreError).not.toHaveBeenCalled();
      },
    );
  }

  it.each([NaN, Infinity, -Infinity, 0, -0.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE])(
    "rejects invalid or unrepresentable token refill rates (%s)",
    async (refillRate) => {
      const policy = { ...policies[2], refillRate };
      await expect(createStore(policy).check("key", policy)).rejects.toMatchObject(configProblem);
    },
  );

  it("preserves fractional refill rates and exact refill boundaries", async () => {
    let now = 10_000;
    const store = new TokenBucketInMemoryStore({ now: () => now, pruneIntervalMs: 0 });
    const policy = policies[2];
    expect((await store.check("key", policy)).remaining).toBe(1);
    expect((await store.check("key", policy)).remaining).toBe(0);
    expect(await store.check("key", policy)).toMatchObject({ success: false, resetAtMs: 12_000 });
    now = 11_999;
    expect((await store.check("key", policy)).success).toBe(false);
    now = 12_000;
    expect(await store.check("key", policy)).toMatchObject({
      success: true,
      remaining: 0,
      resetAtMs: 14_000,
    });
  });

  it("rejects unsafe derived bucket lifetimes even when each integer field is safe", async () => {
    const policy = { ...policies[2], capacity: Number.MAX_SAFE_INTEGER, refillRate: 1 };
    await expect(createStore(policy).check("key", policy)).rejects.toMatchObject(configProblem);
  });

  it("accepts maximum safe integer boundaries without truncating policy fields", async () => {
    const fixed = new FixedWindowInMemoryStore({ now: () => 0, pruneIntervalMs: 0 });
    expect(
      await fixed.check("key", {
        ...policies[0],
        limit: Number.MAX_SAFE_INTEGER,
        windowMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({
      success: true,
      limit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER - 1,
      resetAtMs: Number.MAX_SAFE_INTEGER,
    });
    expect(
      createTokenBucketPolicy("max", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1).capacity,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("validates factories and parsed windows before returning policies", () => {
    expect(() => createFixedWindowPolicy("fixed", 0, 1000)).toThrow();
    expect(() => createSlidingWindowPolicy("sliding", 2, 0.5)).toThrow();
    expect(() => createTokenBucketPolicy("bucket", 2, Infinity)).toThrow();
    expect(() => parseWindowMs("9007199254740991d")).toThrow();
    expect(parseWindowMs("2m")).toBe(120_000);
    expect(createTokenBucketPolicy("bucket", 2, 0.5)).toEqual(policies[2]);
  });

  it.each([
    { name: "invalid", algorithm: "unknown", limit: 2, windowMs: 1000 },
    { name: "invalid", algorithm: null, limit: 2, windowMs: 1000 },
    { name: "invalid", limit: 2, windowMs: 1000, capacity: 3 },
    { name: "invalid", algorithm: "fixed", limit: 2, windowMs: 1000, refillRate: 1 },
    { name: "invalid", algorithm: "sliding", limit: 2, windowMs: 1000, refillIntervalMs: 1000 },
    { ...policies[2], limit: 2 },
    { ...policies[2], windowMs: 1000 },
  ])("rejects malformed policy before admission or refund storage access: %j", async (input) => {
    const policy = input as unknown as RateLimitPolicy;
    const store = createStore(policies[0]);
    const check = vi.spyOn(store, "check");
    const refund = vi.spyOn(store, "refund");
    const keyBuilder = vi.fn(() => "key");
    const onStoreError = vi.fn();
    const limiter = new RateLimiter<Record<string, unknown>>(store, keyBuilder, { onStoreError });
    await expect(limiter.check({}, policy)).rejects.toMatchObject(configProblem);
    await expect(limiter.checkWithKey("key", policy)).rejects.toMatchObject(configProblem);
    await expect(limiter.refund({}, policy)).rejects.toMatchObject(configProblem);
    await expect(limiter.refundWithKey("key", policy)).rejects.toMatchObject(configProblem);
    expect(check).not.toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
    expect(keyBuilder).not.toHaveBeenCalled();
    expect(onStoreError).not.toHaveBeenCalled();
  });

  it("passes the same canonical legacy policy to admission and refund stores", async () => {
    const store = new FixedWindowInMemoryStore({ now: () => 12_345, pruneIntervalMs: 0 });
    const check = vi.spyOn(store, "check");
    const refund = vi.spyOn(store, "refund");
    const limiter = new RateLimiter<Record<string, unknown>>(store, () => "key");
    const policy = Object.freeze({ name: "legacy", limit: 1, windowMs: 10_000 });
    for (const withKey of [false, true]) {
      const result = await (withKey
        ? limiter.checkWithKey("key", policy)
        : limiter.check({}, policy));
      expect(result).toMatchObject({ success: true, remaining: 0, resetAtMs: 20_000 });
      const refunded = await (withKey
        ? limiter.refundWithKey("key", policy, result.refundReceipt)
        : limiter.refund({}, policy, result.refundReceipt));
      expect(refunded).toMatchObject({ refunded: true, remaining: 1 });
      expect(check).toHaveBeenLastCalledWith("key", { ...policy, algorithm: "fixed" });
      expect(refund).toHaveBeenLastCalledWith(
        "key",
        { ...policy, algorithm: "fixed" },
        result.refundReceipt,
      );
    }
  });

  it("preserves inherited legacy policy fields during normalization", async () => {
    class LegacyPolicy {
      get name(): string {
        return "legacy";
      }
      get limit(): number {
        return 1;
      }
      get windowMs(): number {
        return 10_000;
      }
    }
    const store = new FixedWindowInMemoryStore({ now: () => 12_345, pruneIntervalMs: 0 });
    const limiter = new RateLimiter(store, () => "key");
    const policy = new LegacyPolicy();
    const result = await limiter.checkWithKey("key", policy);
    expect(result).toMatchObject({ success: true, limit: 1, remaining: 0, resetAtMs: 20_000 });
    expect(result.degraded).toBeUndefined();
    expect(await limiter.refundWithKey("key", policy, result.refundReceipt)).toMatchObject({
      refunded: true,
      remaining: 1,
      resetAtMs: 20_000,
    });
  });

  it("validates legacy policies before store access", async () => {
    const store = new FixedWindowInMemoryStore({ pruneIntervalMs: 0 });
    const check = vi.spyOn(store, "check");
    const limiter = new RateLimiter(store, () => "key");
    await expect(
      limiter.checkWithKey("key", { name: "legacy", limit: NaN, windowMs: 1000 }),
    ).rejects.toMatchObject(configProblem);
    expect(check).not.toHaveBeenCalled();
  });
});
