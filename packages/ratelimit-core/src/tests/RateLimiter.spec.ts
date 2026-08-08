import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../libs/RateLimiter";
import { type KeyContext, RateLimitKeyBuilder } from "../libs/RateLimitKeyBuilder";
import type { RateLimitStore } from "../libs/RateLimitStore";
import type { RateLimitPolicy, RateLimitRefundReceipt, RateLimitResult } from "../libs/types";

describe("RateLimiter", () => {
  let mockStore!: RateLimitStore;
  let keyBuilder!: RateLimitKeyBuilder;
  let rateLimiter!: RateLimiter;

  const policy: RateLimitPolicy = {
    name: "test-policy",
    algorithm: "sliding",
    limit: 10,
    windowMs: 60000,
  };

  const createContext = (data: Record<string, unknown>): KeyContext => ({
    get: <T>(key: string): T | undefined => data[key] as T | undefined,
  });

  const successResult: RateLimitResult = {
    success: true,
    degraded: false,
    limit: 10,
    remaining: 9,
    resetAtMs: Date.now() + 60000,
    policyName: "store-policy-name",
  };
  const refundReceipt: RateLimitRefundReceipt = {
    algorithm: "sliding",
    id: "receipt-1",
    timestamp: Date.now(),
  };

  const failedResult: RateLimitResult = {
    success: false,
    degraded: false,
    limit: 10,
    remaining: 0,
    resetAtMs: Date.now() + 60000,
    policyName: "store-policy-name",
  };

  beforeEach(() => {
    mockStore = {
      check: vi.fn().mockResolvedValue(successResult),
      refund: vi.fn().mockResolvedValue({ ...successResult, remaining: 10, refunded: true }),
      getStats: vi.fn().mockResolvedValue({ allowed: 0, denied: 0, total: 0 }),
      pruneExpired: vi.fn().mockResolvedValue(0),
    } as unknown as RateLimitStore;
    keyBuilder = new RateLimitKeyBuilder(["tenant", "user"]);
    rateLimiter = new RateLimiter(mockStore, keyBuilder);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("check", () => {
    it("should build key and call store", async () => {
      const context = createContext({
        tenant: { id: "tenant_123" },
        user: { id: "user_456" },
      });

      const result = await rateLimiter.check(context, policy);

      expect(mockStore.check).toHaveBeenCalledWith(
        'rl2:[["policy","test-policy"],["tenant","tenant_123"],["user","user_456"]]',
        policy,
      );
      expect(result).toEqual({ ...successResult, policyName: "test-policy" });
    });

    it("should return failed result when limit exceeded", async () => {
      vi.mocked(mockStore.check).mockResolvedValue(failedResult);
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.policyName).toBe("test-policy");
    });
  });

  describe("checkWithKey", () => {
    it("should use provided key directly", async () => {
      const result = await rateLimiter.checkWithKey("custom:key", policy);

      expect(mockStore.check).toHaveBeenCalledWith("custom:key", policy);
      expect(result).toEqual({ ...successResult, policyName: "test-policy" });
    });

    it("should keep policies using the same algorithm distinguishable", async () => {
      const loginPolicy = { ...policy, name: "login-per-user" };
      const signupPolicy = { ...policy, name: "signup-per-user" };

      const loginResult = await rateLimiter.checkWithKey("login:key", loginPolicy);
      const signupResult = await rateLimiter.checkWithKey("signup:key", signupPolicy);

      expect(loginResult.policyName).toBe("login-per-user");
      expect(signupResult.policyName).toBe("signup-per-user");
    });

    it("should preserve configured policy names verbatim", async () => {
      const namedPolicy = { ...policy, name: "로그인 정책 / v2" };

      const result = await rateLimiter.checkWithKey("custom:key", namedPolicy);

      expect(result.policyName).toBe("로그인 정책 / v2");
    });

    it("should fill a missing store policy identity with the configured name", async () => {
      vi.mocked(mockStore.check).mockResolvedValue({
        ...successResult,
        policyName: undefined,
      });

      const result = await rateLimiter.checkWithKey("custom:key", policy);

      expect(result.policyName).toBe("test-policy");
    });
  });

  describe("refund", () => {
    it("should build key and refund store quota", async () => {
      const context = createContext({
        tenant: { id: "tenant_123" },
        user: { id: "user_456" },
      });

      const result = await rateLimiter.refund(context, policy, refundReceipt);

      expect(mockStore.refund).toHaveBeenCalledWith(
        'rl2:[["policy","test-policy"],["tenant","tenant_123"],["user","user_456"]]',
        policy,
        refundReceipt,
      );
      expect(result.remaining).toBe(10);
      expect(result.policyName).toBe("test-policy");
    });

    it("should refund a provided key directly", async () => {
      const result = await rateLimiter.refundWithKey("custom:key", policy, refundReceipt);

      expect(mockStore.refund).toHaveBeenCalledWith("custom:key", policy, refundReceipt);
      expect(result.remaining).toBe(10);
      expect(result.policyName).toBe("test-policy");
    });

    it("should report refund store errors without failing open", async () => {
      const onStoreError = vi.fn();
      const error = new Error("refund unavailable");
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { onStoreError });
      vi.mocked(mockStore.refund).mockRejectedValue(error);

      await expect(rateLimiter.refundWithKey("custom:key", policy, refundReceipt)).rejects.toThrow(
        "refund unavailable",
      );
      expect(onStoreError).toHaveBeenCalledWith(error);
    });
  });

  describe("error handling", () => {
    const degradedCases: Array<{
      name: string;
      entrypoint: "check" | "checkWithKey";
      policy: RateLimitPolicy;
      expectedIntervalMs: number;
    }> = [
      {
        name: "one-second fixed window",
        entrypoint: "check",
        policy: {
          name: "fixed-short",
          algorithm: "fixed",
          limit: 5,
          windowMs: 1000,
        },
        expectedIntervalMs: 1000,
      },
      {
        name: "one-hour fixed window",
        entrypoint: "checkWithKey",
        policy: {
          name: "fixed-long",
          algorithm: "fixed",
          limit: 5,
          windowMs: 3600000,
        },
        expectedIntervalMs: 3600000,
      },
      {
        name: "one-second sliding window",
        entrypoint: "check",
        policy: {
          name: "sliding-short",
          algorithm: "sliding",
          limit: 5,
          windowMs: 1000,
        },
        expectedIntervalMs: 1000,
      },
      {
        name: "one-hour sliding window",
        entrypoint: "checkWithKey",
        policy: {
          name: "sliding-long",
          algorithm: "sliding",
          limit: 5,
          windowMs: 3600000,
        },
        expectedIntervalMs: 3600000,
      },
      {
        name: "token bucket next-token cadence",
        entrypoint: "check",
        policy: {
          name: "token-bucket",
          algorithm: "token-bucket",
          capacity: 12,
          refillRate: 3,
          refillIntervalMs: 1000,
        },
        expectedIntervalMs: 1000 / 3,
      },
      {
        name: "legacy window",
        entrypoint: "checkWithKey",
        policy: { name: "legacy", limit: 5, windowMs: 2500 },
        expectedIntervalMs: 2500,
      },
    ];

    it.each(degradedCases)(
      "should derive the degraded reset from the $name policy in both fail modes",
      async ({ entrypoint, policy: degradedPolicy, expectedIntervalMs }) => {
        vi.useFakeTimers();
        const now = Date.UTC(2026, 0, 1);
        vi.setSystemTime(now);
        vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));

        for (const failOpen of [true, false]) {
          const limiter = new RateLimiter(mockStore, keyBuilder, { failOpen });
          const result =
            entrypoint === "check"
              ? await limiter.check(createContext({ tenant: { id: "t1" } }), degradedPolicy)
              : await limiter.checkWithKey("custom:key", degradedPolicy);
          const limit =
            "capacity" in degradedPolicy ? degradedPolicy.capacity : degradedPolicy.limit;

          expect(result).toMatchObject({
            success: failOpen,
            degraded: true,
            limit,
            remaining: failOpen ? limit : 0,
            resetAtMs: now + expectedIntervalMs,
            policyName: degradedPolicy.name,
          });
        }
      },
    );

    it("should use the failure timestamp captured before the store error callback", async () => {
      vi.useFakeTimers();
      const now = Date.UTC(2026, 0, 1);
      vi.setSystemTime(now);
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));
      const onStoreError = vi.fn(() => vi.setSystemTime(now + 5000));
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { onStoreError });

      const result = await rateLimiter.checkWithKey("custom:key", {
        name: "callback-clock",
        algorithm: "sliding",
        limit: 5,
        windowMs: 1000,
      });

      expect(result.resetAtMs).toBe(now + 1000);
      expect(onStoreError).toHaveBeenCalledOnce();
    });

    it("should preserve a healthy store reset timestamp through both check entrypoints", async () => {
      const resetAtMs = Date.UTC(2030, 0, 1);
      vi.mocked(mockStore.check).mockResolvedValue({
        ...successResult,
        resetAtMs,
      });
      const context = createContext({ tenant: { id: "t1" } });

      const contextResult = await rateLimiter.check(context, policy);
      const keyResult = await rateLimiter.checkWithKey("custom:key", policy);

      expect(contextResult.resetAtMs).toBe(resetAtMs);
      expect(keyResult.resetAtMs).toBe(resetAtMs);
    });

    it("should allow request when store fails and failOpen is true (default)", async () => {
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.policyName).toBe("test-policy");
    });

    it("should reject request when store fails and failOpen is false", async () => {
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { failOpen: false });
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(false);
      expect(result.degraded).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.policyName).toBe("test-policy");
    });

    it("should let an explicit check policy override the limiter default during store failure", async () => {
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));

      const closedResult = await rateLimiter.checkWithKey("closed:key", policy, {
        failOpen: false,
      });
      const openLimiter = new RateLimiter(mockStore, keyBuilder, { failOpen: false });
      const openResult = await openLimiter.checkWithKey("open:key", policy, { failOpen: true });

      expect(closedResult).toMatchObject({ success: false, degraded: true, remaining: 0 });
      expect(openResult).toMatchObject({ success: true, degraded: true, remaining: 10 });
    });

    it("should call onStoreError callback when store fails", async () => {
      const onStoreError = vi.fn();
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { onStoreError });
      const error = new Error("Connection refused");
      vi.mocked(mockStore.check).mockRejectedValue(error);
      const context = createContext({ tenant: { id: "t1" } });

      await rateLimiter.check(context, policy);

      expect(onStoreError).toHaveBeenCalledWith(error);
    });
  });

  describe("getStats", () => {
    it("should return healthy zero stats without degraded metadata", async () => {
      const result = await rateLimiter.getStats("test-store");

      expect(result).toEqual({ allowed: 0, denied: 0, total: 0 });
    });

    it("should mark stats degraded on store error and call onStoreError", async () => {
      const onStoreError = vi.fn();
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { onStoreError });
      const error = new Error("Store unavailable");
      vi.mocked(mockStore.getStats).mockRejectedValue(error);

      const result = await rateLimiter.getStats("test-store");

      expect(result).toEqual({
        allowed: 0,
        denied: 0,
        total: 0,
        degraded: true,
        error: {
          name: "Error",
          message: "Store unavailable",
        },
      });
      expect(onStoreError).toHaveBeenCalledWith(error);
    });

    it("should normalize non-Error stats failures before reporting degraded stats", async () => {
      const onStoreError = vi.fn();
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { onStoreError });
      vi.mocked(mockStore.getStats).mockRejectedValue("store offline");

      const result = await rateLimiter.getStats("test-store");

      expect(result).toEqual({
        allowed: 0,
        denied: 0,
        total: 0,
        degraded: true,
        error: {
          name: "Error",
          message: "store offline",
        },
      });
      expect(onStoreError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "store offline" }),
      );
    });
  });
});
