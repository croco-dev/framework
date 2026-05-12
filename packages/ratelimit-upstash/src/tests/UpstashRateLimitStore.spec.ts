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
      ["custom:test-key"],
      [10, 60, expect.any(Number)],
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

  it("should throw error for invalid policy", async () => {
    const policy = createFixedWindowPolicy("test", 10, 60000);

    await expect(store.check("test-key", policy)).rejects.toThrow(
      "Invalid policy for token bucket store",
    );
  });

  it("should reset keys", async () => {
    await store.reset("test-key");

    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:bucket:test-key");
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
