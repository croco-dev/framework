import { createUpstashRedisMeteringConformanceSuite } from "@croco/testing";
import type { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUpstashRedisClient,
  createUpstashRedisClientFromEnv,
  UpstashRedisClient,
} from "../libs/UpstashRedisClient";

type ConformanceScenario =
  | "success"
  | "duplicate-idempotency"
  | "retryable-upstream"
  | "terminal-upstream";

const UPSTASH_REDIS_LIVE_ENV = [
  "CROCO_LIVE_UPSTASH_REDIS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
const SECRET_SAMPLE = "super-secret-token";
const SECRET_RICH_ERROR_MESSAGE = `Authorization: Bearer ${SECRET_SAMPLE}; "token":"${SECRET_SAMPLE}"; https://example.upstash.io?token=${SECRET_SAMPLE}; Cookie: session=${SECRET_SAMPLE}`;

function createMockRedis(): Redis {
  return {
    eval: vi.fn(),
    set: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
  } as unknown as Redis;
}

function createUpstreamError(message: string, status: number): Error & { readonly status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function createConformanceClient(scenario: ConformanceScenario): UpstashRedisClient {
  const redis = createMockRedis();

  if (scenario === "success") {
    vi.mocked(redis.set).mockResolvedValue("OK");
    vi.mocked(redis.zadd).mockResolvedValue(1);
    vi.mocked(redis.zrange).mockResolvedValue([
      "usage-1:5:%7B%22source%22%3A%22conformance%22%7D",
      String(Date.UTC(2026, 0, 1)),
    ]);
    vi.mocked(redis.eval).mockResolvedValue([0, 5]);
  }

  if (scenario === "duplicate-idempotency") {
    vi.mocked(redis.set).mockResolvedValue(null);
  }

  if (scenario === "retryable-upstream") {
    vi.mocked(redis.zadd).mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 503));
  }

  if (scenario === "terminal-upstream") {
    vi.mocked(redis.zrange).mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 400));
  }

  return new UpstashRedisClient(redis);
}

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Upstash Redis metering live smoke.`);
  }

  return value;
}

async function runUpstashMeteringLiveSmoke(): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    token: readRequiredEnv("UPSTASH_REDIS_REST_TOKEN"),
    url: readRequiredEnv("UPSTASH_REDIS_REST_URL"),
  });
  const client = createUpstashRedisClient(redis);
  const key = `croco:metering-upstash:smoke:${Date.now()}`;

  await client.set(`${key}:dedupe`, "1", "NX", "EX", 60);
  await client.zadd(key, Date.now(), "usage-live-smoke:1");

  const members = await client.zrangebyscore(key, 0, Number.POSITIVE_INFINITY);
  expect(members).toContain("usage-live-smoke:1");

  await redis.del(key);
  await redis.del(`${key}:dedupe`);
}

describe("UpstashRedisClient", () => {
  let client!: UpstashRedisClient;
  let mockRedis!: Redis;

  beforeEach(() => {
    mockRedis = createMockRedis();

    client = new UpstashRedisClient(mockRedis);
  });

  describe("Upstash Redis metering conformance", () => {
    it.each(
      createUpstashRedisMeteringConformanceSuite({
        createClient: createConformanceClient,
        createMissingConfig: () => new UpstashRedisClient(undefined as never),
        liveSmoke: {
          isEnabled: () =>
            isTruthyEnv("CROCO_LIVE_UPSTASH_REDIS") &&
            UPSTASH_REDIS_LIVE_ENV.every((name) => Boolean(process.env[name])),
          requiredEnv: UPSTASH_REDIS_LIVE_ENV,
          run: runUpstashMeteringLiveSmoke,
        },
        providerName: "metering-upstash",
        secretSamples: [SECRET_SAMPLE],
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("zadd", () => {
    it("should call redis.zadd with correct parameters", async () => {
      vi.mocked(mockRedis.zadd).mockResolvedValue(1);

      const result = await client.zadd("test-key", 1234567890, "member-value");

      expect(mockRedis.zadd).toHaveBeenCalledWith("test-key", {
        score: 1234567890,
        member: "member-value",
      });
      expect(result).toBe(1);
    });

    it("should return 0 for non-number result", async () => {
      vi.mocked(mockRedis.zadd).mockResolvedValue(null as unknown as number);

      const result = await client.zadd("test-key", 123, "member");

      expect(result).toBe(0);
    });
  });

  describe("zrangebyscore", () => {
    it("should call redis.zrange with byScore option", async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue(["member1", "member2"]);

      const result = await client.zrangebyscore("test-key", 100, 200);

      expect(mockRedis.zrange).toHaveBeenCalledWith("test-key", 100, 200, {
        byScore: true,
      });
      expect(result).toEqual(["member1", "member2"]);
    });

    it("should convert non-string values to strings", async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue([123, 456]);

      const result = await client.zrangebyscore("test-key", 0, 1000);

      expect(result).toEqual(["123", "456"]);
    });

    it("should request scores when WITHSCORES is passed", async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue(["member1", 100, "member2", 200]);

      const result = await client.zrangebyscore("test-key", 100, 200, "WITHSCORES");

      expect(mockRedis.zrange).toHaveBeenCalledWith("test-key", 100, 200, {
        byScore: true,
        withScores: true,
      });
      expect(result).toEqual(["member1", "100", "member2", "200"]);
    });

    it("should return empty array when no results", async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue([]);

      const result = await client.zrangebyscore("test-key", 0, 1000);

      expect(result).toEqual([]);
    });
  });

  describe("set", () => {
    it("should call redis.set with NX and EX options", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      const result = await client.set("test-key", "value", "NX", "EX", 3600);

      expect(mockRedis.set).toHaveBeenCalledWith("test-key", "value", {
        nx: true,
        ex: 3600,
      });
      expect(result).toBe("OK");
    });

    it("should return null when key already exists", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      const result = await client.set("existing-key", "value", "NX", "EX", 3600);

      expect(result).toBeNull();
    });
  });

  describe("eval", () => {
    it("should call redis.eval with script, keys, and args", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, 8]);

      const result = await client.eval<[number, number]>("return {0, 8}", ["key-1"], [10, 5]);

      expect(mockRedis.eval).toHaveBeenCalledWith("return {0, 8}", ["key-1"], [10, 5]);
      expect(result).toEqual([0, 8]);
    });
  });

  describe("createUpstashRedisClient", () => {
    it("should create UpstashRedisClient instance", () => {
      const instance = createUpstashRedisClient(mockRedis);

      expect(instance).toBeInstanceOf(UpstashRedisClient);
    });

    it("should create UpstashRedisClient from explicit environment values", () => {
      const instance = createUpstashRedisClientFromEnv({
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      });

      expect(instance).toBeInstanceOf(UpstashRedisClient);
    });
  });
});
