import {
  createFixedWindowPolicy,
  createSlidingWindowPolicy,
  createTokenBucketPolicy,
} from "@croco/ratelimit-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UpstashFixedWindowStore,
  UpstashSlidingWindowStore,
  UpstashTokenBucketStore,
} from "../libs/UpstashRateLimitStore";

describe("UpstashFixedWindowStore", () => {
  let store!: UpstashFixedWindowStore;
  let mockRedis!: {
    eval: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      expire: vi.fn(),
    };
    store = new UpstashFixedWindowStore({ redis: mockRedis as never });
  });

  it("should allow requests within limit", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9]);

    const policy = createFixedWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("should deny requests exceeding limit", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0]);

    const policy = createFixedWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track stats", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9]);

    const policy = createFixedWindowPolicy("test", 10, 60000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(1);
    expect(stats.denied).toBe(0);
  });

  it("should refund quota and stats", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 1, 9])
      .mockResolvedValueOnce([1, 0, 10])
      .mockResolvedValueOnce([0, 0, 10]);

    const policy = createFixedWindowPolicy("test", 10, 60000);
    const check = await store.check("test-key", policy);
    const receipt = check.refundReceipt;
    expect(receipt?.algorithm).toBe("fixed");
    if (!receipt || receipt.algorithm !== "fixed") {
      throw new Error("expected fixed window refund receipt");
    }

    const refund = await store.refund("test-key", policy, receipt);
    const duplicateRefund = await store.refund("test-key", policy, receipt);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(10);
    expect(duplicateRefund.refunded).toBe(false);
    expect(mockRedis.eval).toHaveBeenLastCalledWith(
      expect.any(String),
      ["ratelimit:fixed:test-key", "ratelimit:fixed:test-key:receipts"],
      [10, 60, receipt.windowStart, receipt.id],
    );
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should use custom prefix", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9]);

    const customStore = new UpstashFixedWindowStore({
      redis: mockRedis as never,
      prefix: "custom",
    });

    const policy = createFixedWindowPolicy("test", 10, 60000);
    await customStore.check("test-key", policy);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      ["custom:test-key", "custom:test-key:receipts"],
      [10, 60, expect.any(Number), expect.any(String)],
    );
  });

  it("should throw error for invalid policy", async () => {
    const policy = createSlidingWindowPolicy("test", 10, 60000);

    await expect(store.check("test-key", policy)).rejects.toThrow(
      "Invalid policy for fixed window store",
    );
  });

  it("should reset keys", async () => {
    mockRedis.del.mockResolvedValue(2);

    await store.reset("test-key");

    expect(mockRedis.keys).not.toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:fixed:test-key");
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:fixed:test-key:receipts");
  });

  it("should handle getCount", async () => {
    mockRedis.get.mockResolvedValue("5");

    const count = await store.getCount("test-key");

    expect(count).toBe(5);
  });

  it("should handle getCount with null value", async () => {
    mockRedis.get.mockResolvedValue(null);

    const count = await store.getCount("test-key");

    expect(count).toBe(0);
  });

  it("should handle increment", async () => {
    mockRedis.get.mockResolvedValue("5");

    const newValue = await store.increment("test-key", 3);

    expect(newValue).toBe(8);
    expect(mockRedis.set).toHaveBeenCalledWith("ratelimit:fixed:test-key:increment", "8");
  });

  it("should handle expire", async () => {
    await store.expire("test-key", 60000);

    expect(mockRedis.expire).toHaveBeenCalledWith("ratelimit:fixed:test-key:expire", 60);
  });

  it("should handle pruneExpired", async () => {
    const count = await store.pruneExpired();

    expect(count).toBe(0);
  });

  it("should track denied stats", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0]);

    const policy = createFixedWindowPolicy("test", 10, 60000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(0);
    expect(stats.denied).toBe(1);
  });
});

describe("UpstashSlidingWindowStore", () => {
  let store!: UpstashSlidingWindowStore;
  let mockRedis!: {
    eval: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };
    store = new UpstashSlidingWindowStore({ redis: mockRedis as never });
  });

  it("should allow requests within limit", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("should deny requests exceeding limit", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track stats", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(1);
    expect(stats.denied).toBe(0);
  });

  it("should refund quota and stats", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 1, 9])
      .mockResolvedValueOnce([1, 0, 10])
      .mockResolvedValueOnce([0, 0, 10]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    const check = await store.check("test-key", policy);
    const receipt = check.refundReceipt;
    const refund = await store.refund("test-key", policy, receipt);
    const duplicateRefund = await store.refund("test-key", policy, receipt);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(10);
    expect(duplicateRefund.refunded).toBe(false);
    expect(mockRedis.eval).toHaveBeenLastCalledWith(
      expect.any(String),
      ["ratelimit:sliding:test-key"],
      [expect.any(Number), 10, receipt?.id, 61],
    );
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should throw error for invalid policy", async () => {
    const policy = createFixedWindowPolicy("test", 10, 60000);

    await expect(store.check("test-key", policy)).rejects.toThrow(
      "Invalid policy for sliding window store",
    );
  });

  it("should reset keys", async () => {
    await store.reset("test-key");

    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:sliding:test-key");
  });

  it("should handle pruneExpired", async () => {
    const count = await store.pruneExpired();

    expect(count).toBe(0);
  });

  it("should handle increment", async () => {
    mockRedis.get.mockResolvedValue("5");

    const newValue = await store.increment("test-key", 2);

    expect(newValue).toBe(7);
  });

  it("should handle getCount", async () => {
    const count = await store.getCount();

    expect(count).toBe(0);
  });

  it("should track denied stats", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(0);
    expect(stats.denied).toBe(1);
  });
});

describe("UpstashTokenBucketStore", () => {
  let store!: UpstashTokenBucketStore;
  let mockRedis!: {
    eval: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };
    store = new UpstashTokenBucketStore({ redis: mockRedis as never });
  });

  it("should allow requests when tokens available", async () => {
    mockRedis.eval.mockResolvedValue([1, 9, 9]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("should deny requests when no tokens available", async () => {
    mockRedis.eval.mockResolvedValue([0, 0, 0]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track stats", async () => {
    mockRedis.eval.mockResolvedValue([1, 9, 9]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(1);
    expect(stats.denied).toBe(0);
  });

  it("should refund quota and stats", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 9, 9])
      .mockResolvedValueOnce([1, 10, 10])
      .mockResolvedValueOnce([0, 10, 10]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const check = await store.check("test-key", policy);
    const receipt = check.refundReceipt;
    expect(receipt?.algorithm).toBe("token-bucket");
    if (!receipt || receipt.algorithm !== "token-bucket") {
      throw new Error("expected token bucket refund receipt");
    }

    const refund = await store.refund("test-key", policy, check.refundReceipt);
    const duplicateRefund = await store.refund("test-key", policy, check.refundReceipt);

    expect(refund.refunded).toBe(true);
    expect(refund.remaining).toBe(10);
    expect(duplicateRefund.refunded).toBe(false);
    expect(mockRedis.eval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["ratelimit:bucket:test-key", "ratelimit:bucket:test-key:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, receipt.id, receipt.expiresAtMs],
    );
    expect(mockRedis.eval).toHaveBeenLastCalledWith(
      expect.any(String),
      ["ratelimit:bucket:test-key", "ratelimit:bucket:test-key:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, receipt.id],
    );
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should not roll stats back when an expired token bucket receipt is rejected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    mockRedis.eval
      .mockResolvedValueOnce([1, 9, 9])
      .mockResolvedValueOnce([1, 9, 9])
      .mockResolvedValueOnce([0, 9, 9]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const staleCheck = await store.check("test-key", policy);
    const staleReceipt = staleCheck.refundReceipt;
    expect(staleReceipt?.algorithm).toBe("token-bucket");
    if (!staleReceipt || staleReceipt.algorithm !== "token-bucket") {
      throw new Error("expected token bucket refund receipt");
    }

    vi.advanceTimersByTime(11000);
    await store.check("test-key", policy);
    const refund = await store.refund("test-key", policy, staleReceipt);

    expect(refund.refunded).toBe(false);
    expect(mockRedis.eval).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      ["ratelimit:bucket:test-key", "ratelimit:bucket:test-key:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, staleReceipt.id],
    );
    expect(await store.getStats()).toEqual({ allowed: 2, denied: 0, total: 2 });

    vi.useRealTimers();
  });

  it("should throw error for invalid policy", async () => {
    const policy = createFixedWindowPolicy("test", 10, 60000);

    await expect(store.check("test-key", policy)).rejects.toThrow(
      "Invalid policy for token bucket store",
    );
  });

  it("should reset keys", async () => {
    await store.reset("test-key");

    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:bucket:test-key");
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:bucket:test-key:receipts");
  });

  it("should handle pruneExpired", async () => {
    const count = await store.pruneExpired();

    expect(count).toBe(0);
  });

  it("should handle increment", async () => {
    mockRedis.get.mockResolvedValue("3");

    const newValue = await store.increment("test-key", 4);

    expect(newValue).toBe(7);
  });

  it("should handle getCount", async () => {
    const count = await store.getCount();

    expect(count).toBe(0);
  });

  it("should track denied stats", async () => {
    mockRedis.eval.mockResolvedValue([0, 0, 0]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(0);
    expect(stats.denied).toBe(1);
  });
});
