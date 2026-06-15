import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../libs/RateLimiter";
import { type KeyContext, RateLimitKeyBuilder } from "../libs/RateLimitKeyBuilder";
import type { RateLimitStore } from "../libs/RateLimitStore";
import type { RateLimitPolicy, RateLimitResult } from "../libs/types";

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
    policyName: "sliding",
  };

  const failedResult: RateLimitResult = {
    success: false,
    degraded: false,
    limit: 10,
    remaining: 0,
    resetAtMs: Date.now() + 60000,
    policyName: "sliding",
  };

  beforeEach(() => {
    mockStore = {
      check: vi.fn().mockResolvedValue(successResult),
      getStats: vi.fn().mockResolvedValue({ allowed: 0, denied: 0, total: 0 }),
      pruneExpired: vi.fn().mockResolvedValue(0),
    } as unknown as RateLimitStore;
    keyBuilder = new RateLimitKeyBuilder(["tenant", "user"]);
    rateLimiter = new RateLimiter(mockStore, keyBuilder);
  });

  describe("check", () => {
    it("should build key and call store", async () => {
      const context = createContext({
        tenant: { id: "tenant_123" },
        user: { id: "user_456" },
      });

      const result = await rateLimiter.check(context, policy);

      expect(mockStore.check).toHaveBeenCalledWith("rl:test-policy:tenant_123:user_456", policy);
      expect(result).toEqual(successResult);
    });

    it("should return failed result when limit exceeded", async () => {
      vi.mocked(mockStore.check).mockResolvedValue(failedResult);
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe("checkWithKey", () => {
    it("should use provided key directly", async () => {
      const result = await rateLimiter.checkWithKey("custom:key", policy);

      expect(mockStore.check).toHaveBeenCalledWith("custom:key", policy);
      expect(result).toEqual(successResult);
    });
  });

  describe("error handling", () => {
    it("should allow request when store fails and failOpen is true (default)", async () => {
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should reject request when store fails and failOpen is false", async () => {
      rateLimiter = new RateLimiter(mockStore, keyBuilder, { failOpen: false });
      vi.mocked(mockStore.check).mockRejectedValue(new Error("Redis timeout"));
      const context = createContext({ tenant: { id: "t1" } });

      const result = await rateLimiter.check(context, policy);

      expect(result.success).toBe(false);
      expect(result.degraded).toBe(true);
      expect(result.remaining).toBe(0);
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
