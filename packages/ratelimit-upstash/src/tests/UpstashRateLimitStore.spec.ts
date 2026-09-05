import {
  createFixedWindowPolicy,
  createSlidingWindowPolicy,
  createTokenBucketPolicy,
} from "@croco/ratelimit-core";
import { createUpstashRedisRateLimitConformanceSuite } from "@croco/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UpstashFixedWindowStore,
  UpstashSlidingWindowStore,
  UpstashTokenBucketStore,
} from "../libs/UpstashRateLimitStore";
import { tokenBucketLua } from "../libs/lua/token-bucket";
import { tokenBucketRefillLua } from "../libs/lua/token-bucket-refill";
import { tokenBucketRefundLua } from "../libs/lua/token-bucket-refund";

type ConformanceScenario = "allow" | "deny" | "retryable-upstream" | "terminal-upstream";
const UPSTASH_REDIS_LIVE_ENV = [
  "CROCO_LIVE_UPSTASH_REDIS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
const SECRET_SAMPLE = "super-secret-token";
const SECRET_RICH_ERROR_MESSAGE = `Authorization: Bearer ${SECRET_SAMPLE}; "token":"${SECRET_SAMPLE}"; https://example.upstash.io?token=${SECRET_SAMPLE}; Cookie: session=${SECRET_SAMPLE}`;

function createMockRedis(): {
  eval: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  incrbyfloat: ReturnType<typeof vi.fn>;
} {
  return {
    eval: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    expire: vi.fn(),
    incrbyfloat: vi.fn(),
  };
}

function redisClusterSlot(key: string): number {
  const open = key.indexOf("{");
  const close = key.indexOf("}", open + 1);
  const hashKey = open >= 0 && close > open + 1 ? key.slice(open + 1, close) : key;
  let crc = 0;
  for (const byte of new TextEncoder().encode(hashKey)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }
  return crc % 16384;
}

describe("Redis Cluster key routing", () => {
  it("should match Redis CRC16 and first-brace-pair semantics", () => {
    expect(redisClusterSlot("123456789")).toBe(12739);
    expect(redisClusterSlot("foo{bar}{zap}")).toBe(redisClusterSlot("bar"));
    expect(redisClusterSlot("foo{{bar}}zap")).toBe(redisClusterSlot("{bar"));
    expect(redisClusterSlot("foo{}{bar}")).toBe(8363);
  });

  describe.each([
    {
      algorithm: "fixed",
      Store: UpstashFixedWindowStore,
      defaultPrefix: "ratelimit:fixed",
      policy: createFixedWindowPolicy("cluster", 10, 60_000),
    },
    {
      algorithm: "token-bucket",
      Store: UpstashTokenBucketStore,
      defaultPrefix: "ratelimit:bucket",
      policy: createTokenBucketPolicy("cluster", 10, 1, 1_000),
    },
  ])("$algorithm", ({ Store, defaultPrefix, policy }) => {
    it.each([
      { prefix: undefined, key: "client-1" },
      { prefix: "custom", key: "client-1" },
      { prefix: "", key: "" },
      { prefix: "}", key: "client-1" },
      { prefix: "{}", key: "client-1" },
      { prefix: "tenant:{region}", key: "client:{one}" },
      { prefix: "{", key: "}" },
      { prefix: "한글", key: "사용자:🚀" },
    ])(
      "should colocate check/refund keys and reset them for $prefix/$key",
      async ({ prefix, key }) => {
        const redis = createMockRedis();
        redis.eval.mockImplementation((_script: string, keys: string[]) => {
          expect(keys).toHaveLength(2);
          expect(new Set(keys.map(redisClusterSlot)).size).toBe(1);
          expect(keys[0]).toMatch(/^\{[^{}]+\}$/);
          expect(keys[1]).toBe(`${keys[0]}:receipts`);
          return [1, 1, 9, String(Date.now())];
        });
        const store = new Store({ redis: redis as never, prefix });

        const check = await store.check(key, policy);
        const refund = await store.refund(key, policy, check.refundReceipt);
        await store.reset(key);

        expect(check.success).toBe(true);
        expect(refund.refunded).toBe(true);
        const checkKeys = redis.eval.mock.calls[0]?.[1] as string[];
        expect(redis.eval.mock.calls[1]?.[1]).toEqual(checkKeys);
        expect(redis.del.mock.calls).toEqual([
          [checkKeys[0]],
          [checkKeys[1]],
          [`${prefix ?? defaultPrefix}:${key}:increment`],
        ]);
      },
    );

    it("should keep brace, percent-escaped, and receipt-suffixed identities distinct", async () => {
      const redis = createMockRedis();
      redis.eval.mockResolvedValue([1, 1, 9, String(Date.now())]);
      const identities = ["user", "user:receipts", "{user}", "%7Buser%7D", "{}", "%", "%25"];
      for (const key of identities) {
        await new Store({ redis: redis as never }).check(key, policy);
        await new Store({ redis: redis as never, prefix: key }).check("client", policy);
      }
      const keys = redis.eval.mock.calls.flatMap((call) => call[1] as string[]);
      expect(new Set(keys).size).toBe(identities.length * 4);
    });
  });
});

function createUpstreamError(message: string, status: number): Error & { readonly status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function createConformanceStore(scenario: ConformanceScenario): UpstashFixedWindowStore {
  const redis = createMockRedis();

  if (scenario === "allow") {
    redis.eval
      .mockResolvedValueOnce([1, 1, 1])
      .mockResolvedValueOnce([1, 0, 2])
      .mockResolvedValueOnce([0, 0, 2]);
  }

  if (scenario === "deny") {
    redis.eval.mockResolvedValueOnce([0, 2, 0]);
  }

  if (scenario === "retryable-upstream") {
    redis.eval.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 503));
  }

  if (scenario === "terminal-upstream") {
    redis.eval.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 400));
  }

  return new UpstashFixedWindowStore({ redis: redis as never });
}

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Upstash Redis live smoke.`);
  }

  return value;
}

async function runUpstashRedisLiveSmoke(): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    token: readRequiredEnv("UPSTASH_REDIS_REST_TOKEN"),
    url: readRequiredEnv("UPSTASH_REDIS_REST_URL"),
  });
  const key = `smoke:${Date.now()}`;
  const prefix = `croco:ratelimit-upstash:${Date.now()}`;
  const store = new UpstashFixedWindowStore({
    prefix,
    redis,
  });
  const policy = createFixedWindowPolicy("live-smoke", 2, 1_000);

  const result = await store.check(key, policy);
  expect(result.success).toBe(true);
  expect(result.refundReceipt?.algorithm).toBe("fixed");

  if (result.refundReceipt?.algorithm === "fixed") {
    await store.refund(key, policy, result.refundReceipt);
  }

  await store.reset(key);

  const counterStores = [
    ["fixed", new UpstashFixedWindowStore({ prefix, redis })],
    ["sliding", new UpstashSlidingWindowStore({ prefix, redis })],
    ["token-bucket", new UpstashTokenBucketStore({ prefix, redis })],
  ] as const;

  for (const [algorithm, counterStore] of counterStores) {
    const counterKey = `${key}:${algorithm}`;
    const increments = await Promise.all(
      Array.from({ length: 20 }, () => counterStore.increment(counterKey, 0.5)),
    );

    expect(Math.max(...increments)).toBe(10);
    expect(await counterStore.getCount(counterKey)).toBe(10);
    expect(await counterStore.increment(counterKey, -1.25)).toBe(8.75);

    await counterStore.expire(counterKey, 5_000);
    const redisCounterKey = `${prefix}:${counterKey}:increment`;
    const ttlBeforeIncrement = await redis.pttl(redisCounterKey);
    await counterStore.increment(counterKey, 0.25);
    const ttlAfterIncrement = await redis.pttl(redisCounterKey);
    expect(ttlBeforeIncrement).toBeGreaterThan(0);
    expect(ttlAfterIncrement).toBeGreaterThan(0);
    expect(ttlAfterIncrement).toBeLessThanOrEqual(ttlBeforeIncrement);

    await counterStore.reset(counterKey);
    expect(await counterStore.getCount(counterKey)).toBe(0);
  }
}

describe("Upstash Redis rate-limit conformance", () => {
  it.each(
    createUpstashRedisRateLimitConformanceSuite({
      createMissingConfig: () => new UpstashFixedWindowStore({ redis: undefined as never }),
      createStore: createConformanceStore,
      invalidPolicy: createSlidingWindowPolicy("invalid", 2, 1_000),
      liveSmoke: {
        isEnabled: () =>
          isTruthyEnv("CROCO_LIVE_UPSTASH_REDIS") &&
          UPSTASH_REDIS_LIVE_ENV.every((name) => Boolean(process.env[name])),
        requiredEnv: UPSTASH_REDIS_LIVE_ENV,
        run: runUpstashRedisLiveSmoke,
      },
      policy: createFixedWindowPolicy("conformance", 2, 1_000),
      providerName: "ratelimit-upstash",
      secretSamples: [SECRET_SAMPLE],
    }).cases,
  )("$name", async ({ run }) => {
    await run();
  });
});

describe("UpstashFixedWindowStore", () => {
  let store!: UpstashFixedWindowStore;
  let mockRedis!: {
    eval: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    incrbyfloat: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      expire: vi.fn(),
      incrbyfloat: vi.fn(),
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
      ["{ratelimit:fixed:test-key}", "{ratelimit:fixed:test-key}:receipts"],
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
      ["{custom:test-key}", "{custom:test-key}:receipts"],
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
    expect(mockRedis.del).toHaveBeenCalledWith("{ratelimit:fixed:test-key}");
    expect(mockRedis.del).toHaveBeenCalledWith("{ratelimit:fixed:test-key}:receipts");
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:fixed:test-key:increment");
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
    mockRedis.incrbyfloat.mockResolvedValue(7.5);

    const newValue = await store.increment("test-key", 2.5);

    expect(newValue).toBe(7.5);
    expect(mockRedis.incrbyfloat).toHaveBeenCalledWith("ratelimit:fixed:test-key:increment", 2.5);
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should handle expire", async () => {
    await store.expire("test-key", 60000);

    expect(mockRedis.expire).toHaveBeenCalledWith("ratelimit:fixed:test-key:increment", 60);
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
    expire: ReturnType<typeof vi.fn>;
    incrbyfloat: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      expire: vi.fn(),
      incrbyfloat: vi.fn(),
    };
    store = new UpstashSlidingWindowStore({ redis: mockRedis as never });
  });

  it("should allow requests within limit", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9, 1_000]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("should deny requests exceeding limit", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0, 1_000]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should derive resetAtMs from the oldest in-window timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    mockRedis.eval.mockResolvedValue([0, 1, 0, 1_000]);

    try {
      const policy = createSlidingWindowPolicy("test", 1, 60_000);
      const result = await store.check("test-key", policy);

      expect(result.resetAtMs).toBe(61_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should fall back to a full window when no prior entry survives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    mockRedis.eval.mockResolvedValue([1, 1, 0, 10_000]);

    try {
      const policy = createSlidingWindowPolicy("test", 1, 60_000);
      const result = await store.check("test-key", policy);

      expect(result.resetAtMs).toBe(70_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should track stats", async () => {
    mockRedis.eval.mockResolvedValue([1, 1, 9, 1_000]);

    const policy = createSlidingWindowPolicy("test", 10, 60000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(1);
    expect(stats.denied).toBe(0);
  });

  it("should refund quota and stats", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 1, 9, 1_000])
      .mockResolvedValueOnce([1, 0, 10, 2_000])
      .mockResolvedValueOnce([0, 0, 10, 3_000]);

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
      [expect.any(Number), expect.any(Number), 10, receipt?.id, 61],
    );
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should derive resetAtMs from the oldest entry after a refund", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    mockRedis.eval.mockResolvedValueOnce([1, 2, 8, 1_000]).mockResolvedValueOnce([1, 1, 9, 2_000]);

    try {
      const policy = createSlidingWindowPolicy("test", 10, 60_000);
      const check = await store.check("test-key", policy);
      const refund = await store.refund("test-key", policy, check.refundReceipt);

      expect(refund.resetAtMs).toBe(62_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should fall back to a full window when a refund empties the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    mockRedis.eval
      .mockResolvedValueOnce([1, 1, 9, 10_000])
      .mockResolvedValueOnce([1, 0, 10, 10_000]);

    try {
      const policy = createSlidingWindowPolicy("test", 10, 60_000);
      const check = await store.check("test-key", policy);
      const refund = await store.refund("test-key", policy, check.refundReceipt);

      expect(refund.resetAtMs).toBe(70_000);
    } finally {
      vi.useRealTimers();
    }
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
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:sliding:test-key:increment");
  });

  it("should handle pruneExpired", async () => {
    const count = await store.pruneExpired();

    expect(count).toBe(0);
  });

  it("should handle increment", async () => {
    mockRedis.incrbyfloat.mockResolvedValue(4.5);

    const newValue = await store.increment("test-key", -0.5);

    expect(newValue).toBe(4.5);
    expect(mockRedis.incrbyfloat).toHaveBeenCalledWith(
      "ratelimit:sliding:test-key:increment",
      -0.5,
    );
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should handle getCount", async () => {
    mockRedis.get.mockResolvedValue("4.5");

    const count = await store.getCount("test-key");

    expect(count).toBe(4.5);
  });

  it("should expire the increment counter", async () => {
    await store.expire("test-key", 60_000);

    expect(mockRedis.expire).toHaveBeenCalledWith("ratelimit:sliding:test-key:increment", 60);
  });

  it("should track denied stats", async () => {
    mockRedis.eval.mockResolvedValue([0, 10, 0, 1_000]);

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
    expire: ReturnType<typeof vi.fn>;
    incrbyfloat: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      eval: vi.fn(),
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      expire: vi.fn(),
      incrbyfloat: vi.fn(),
    };
    store = new UpstashTokenBucketStore({ redis: mockRedis as never });
  });

  it("should allow requests when tokens available", async () => {
    mockRedis.eval.mockResolvedValue([1, 9, 9, String(Date.now())]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("should deny requests when no tokens available", async () => {
    mockRedis.eval.mockResolvedValue([0, 0, 0, String(Date.now())]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    const result = await store.check("test-key", policy);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track stats", async () => {
    mockRedis.eval.mockResolvedValue([1, 9, 9, String(Date.now())]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(1);
    expect(stats.denied).toBe(0);
  });

  it("should refund quota and stats", async () => {
    mockRedis.eval
      .mockResolvedValueOnce([1, 9, 9, String(Date.now())])
      .mockResolvedValueOnce([1, 10, 10, String(Date.now())])
      .mockResolvedValueOnce([0, 10, 10, String(Date.now())]);

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
      ["{ratelimit:bucket:test-key}", "{ratelimit:bucket:test-key}:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, receipt.id, receipt.expiresAtMs],
    );
    expect(mockRedis.eval).toHaveBeenLastCalledWith(
      expect.any(String),
      ["{ratelimit:bucket:test-key}", "{ratelimit:bucket:test-key}:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, receipt.id],
    );
    expect(await store.getStats()).toEqual({ allowed: 0, denied: 0, total: 0 });
  });

  it("should not roll stats back when an expired token bucket receipt is rejected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    mockRedis.eval
      .mockResolvedValueOnce([1, 9, 9, String(Date.now())])
      .mockResolvedValueOnce([1, 9, 9, String(Date.now())])
      .mockResolvedValueOnce([0, 9, 9, String(Date.now())]);

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
      ["{ratelimit:bucket:test-key}", "{ratelimit:bucket:test-key}:receipts"],
      [expect.any(Number), 10, 1000, 1, 11, staleReceipt.id],
    );
    expect(await store.getStats()).toEqual({ allowed: 2, denied: 0, total: 2 });

    vi.useRealTimers();
  });

  it("should derive the next token boundary from the Lua refill cursor", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1500);
    mockRedis.eval.mockResolvedValue([1, 0, 0, "1000.5"]);

    const policy = createTokenBucketPolicy("test", 2, 1, 1000);
    const result = await store.check("test-key", policy);

    expect(result.resetAtMs).toBe(2000.5);

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

    expect(mockRedis.del).toHaveBeenCalledWith("{ratelimit:bucket:test-key}");
    expect(mockRedis.del).toHaveBeenCalledWith("{ratelimit:bucket:test-key}:receipts");
    expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:bucket:test-key:increment");
  });

  it("should handle pruneExpired", async () => {
    const count = await store.pruneExpired();

    expect(count).toBe(0);
  });

  it("should handle increment", async () => {
    mockRedis.incrbyfloat.mockResolvedValue(7.25);

    const newValue = await store.increment("test-key", 4.25);

    expect(newValue).toBe(7.25);
    expect(mockRedis.incrbyfloat).toHaveBeenCalledWith("ratelimit:bucket:test-key:increment", 4.25);
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should handle getCount", async () => {
    mockRedis.get.mockResolvedValue("7.25");

    const count = await store.getCount("test-key");

    expect(count).toBe(7.25);
  });

  it("should expire the increment counter", async () => {
    await store.expire("test-key", 60_000);

    expect(mockRedis.expire).toHaveBeenCalledWith("ratelimit:bucket:test-key:increment", 60);
  });

  it("should track denied stats", async () => {
    mockRedis.eval.mockResolvedValue([0, 0, 0, String(Date.now())]);

    const policy = createTokenBucketPolicy("test", 10, 1, 1000);
    await store.check("test-key", policy);

    const stats = await store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.allowed).toBe(0);
    expect(stats.denied).toBe(1);
  });
});

describe("token bucket Lua refill contract", () => {
  it("should preserve fractional time below capacity in consume and refund scripts", () => {
    const fractionalCursorAdvance =
      "currentLastRefill = currentLastRefill + (tokensToAdd * intervalMs) / refillRate";

    expect(tokenBucketRefillLua).toContain(fractionalCursorAdvance);
    expect(tokenBucketLua).toContain(fractionalCursorAdvance);
    expect(tokenBucketRefundLua).toContain(fractionalCursorAdvance);
    expect(tokenBucketLua).toContain("return {success, tokens, remaining, serializedLastRefill}");
    expect(tokenBucketRefundLua).toContain("return {1, tokens, tokens, serializedLastRefill}");
    expect(tokenBucketRefillLua).toContain("string.format('%.17g', refillCursor)");
  });

  it("should discard overflow time at full capacity and after a refund fills the bucket", () => {
    expect(tokenBucketRefillLua).toContain("if currentTokens >= capacity then");
    expect(tokenBucketRefillLua).toContain(
      "local nextLastRefill = math.max(currentLastRefill, now)",
    );
    expect(tokenBucketRefillLua).toContain(
      "if currentTokens == capacity then\n    currentLastRefill = now",
    );
    expect(tokenBucketRefundLua).toContain("if tokens == capacity then\n  lastRefill = now");
  });
});
