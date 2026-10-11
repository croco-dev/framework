import {
  IdempotencyManager,
  RedisBillableUsageJournal,
  RedisUsageStorage,
} from "@croco/metering-core";
import { createUpstashRedisMeteringConformanceSuite } from "@croco/testing";
import { Redis } from "@upstash/redis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUpstashRedisClient,
  createUpstashRedisClientFromEnv,
  UpstashRedisClient,
} from "../libs/UpstashRedisClient";
import { InvalidUpstashMeteringDeserializationProblem } from "../libs/problems/UpstashMeteringProblems";

type EvalHandler = (script: string, keys: string[], args: string[]) => unknown;

function encodeUpstashResult(value: unknown): unknown {
  if (typeof value === "string") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return Array.isArray(value) ? value.map(encodeUpstashResult) : value;
}

function stubUpstashRest(handler: EvalHandler): void {
  const execute = (command: unknown[], base64: boolean) => {
    const [name, script, numKeys, ...rest] = command as [string, string, number, ...unknown[]];
    if (name !== "eval") {
      throw new Error(`unexpected command ${String(name)}`);
    }
    const result = handler(
      script,
      rest.slice(0, numKeys).map(String),
      rest.slice(numKeys).map(String),
    );
    return { result: base64 ? encodeUpstashResult(result) : result };
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      const base64 = init.headers["Upstash-Encoding"] === "base64";
      const body = JSON.parse(init.body) as unknown[];
      const payload = url.endsWith("/pipeline")
        ? (body as unknown[][]).map((command) => execute(command, base64))
        : execute(body, base64);
      return new Response(JSON.stringify(payload), { status: 200 });
    }),
  );
}

function createEnvClient(): UpstashRedisClient {
  return createUpstashRedisClientFromEnv({
    UPSTASH_REDIS_REST_URL: "https://example-test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  });
}

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
    automaticDeserialization: false,
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

describe("UpstashRedisClient with metering-core JSON-returning scripts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns appended and duplicate billable usage entries", async () => {
    let appendCount = 0;
    stubUpstashRest((_script, _keys, args) => [appendCount++ === 0 ? 1 : 0, args[1]]);
    const journal = new RedisBillableUsageJournal(createEnvClient());
    const event = {
      eventId: "evt-1",
      tenantId: "tenant-a",
      meterId: "ai.tokens",
      aggregation: "SUM" as const,
      unit: "token",
      value: 42,
      dimensions: {},
    };

    const appended = await journal.append(event);
    const duplicate = await journal.append(event);

    expect(appended.outcome).toBe("appended");
    expect(appended.entry.event.eventId).toBe("evt-1");
    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.entry.event.eventId).toBe("evt-1");
  });

  it("returns the staged delivery when a metering claim is recovered", async () => {
    const delivery = {
      usageRecord: {
        id: "usage-1",
        tenantId: "tenant-a",
        meterId: "api.calls",
        value: 3,
        idempotencyKey: "idem-1",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    };
    stubUpstashRest(() => [1, JSON.stringify(delivery), "01JOPERATION", ""]);
    const manager = new IdempotencyManager(createEnvClient());

    const claim = await manager.claimMeteringProcessingOrThrow("tenant-a", "api.calls", "idem-1");

    expect(claim.operationId).toBe("01JOPERATION");
    expect(claim.delivery).toEqual(delivery);
  });

  it("passes through a scalar Lua result", async () => {
    stubUpstashRest(() => 1);

    await expect(createEnvClient().eval<[number]>("return 1", [], [])).resolves.toBe(1);
  });

  it("resets billing-cycle usage after a scalar Lua result", async () => {
    stubUpstashRest(() => 1);
    const storage = new RedisUsageStorage(createEnvClient());

    await expect(storage.resetBillingCycle("tenant-a", "api.calls")).resolves.toBeUndefined();
  });

  it("reports an injected Redis client with automatic deserialization enabled", async () => {
    stubUpstashRest((_script, _keys, args) => [1, args[1]]);
    const redis = new Redis({
      url: "https://example-test.upstash.io",
      token: "test-token",
    });
    const journal = new RedisBillableUsageJournal(createUpstashRedisClient(redis));
    const event = {
      eventId: "evt-1",
      tenantId: "tenant-a",
      meterId: "ai.tokens",
      aggregation: "SUM" as const,
      unit: "token",
      value: 42,
      dimensions: {},
    };

    await expect(journal.append(event)).rejects.toMatchObject({
      code: "metering-upstash/automatic-deserialization-enabled",
      message: expect.stringContaining("automaticDeserialization: false"),
      extensions: { retryable: false },
    });
    await expect(journal.append(event)).rejects.toBeInstanceOf(
      InvalidUpstashMeteringDeserializationProblem,
    );
  });
});
