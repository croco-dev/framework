import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import { RedisProblem } from "../libs/problems/RedisProblem";
import type { RedisClient } from "../libs/RedisClient";
import { RedisUsageStorage } from "../libs/RedisUsageStorage";
import type { UsageQueryOptions, UsageRecord } from "../libs/types";

describe("RedisUsageStorage", () => {
  let storage!: RedisUsageStorage;
  let mockRedis!: RedisClient;

  const getRecordedRecordKeys = (): Map<string, number> =>
    Reflect.get(storage, "recordedRecordKeys") as Map<string, number>;

  const createUsageRecord = (idempotencyKey: string): UsageRecord => ({
    id: `usage-${idempotencyKey}`,
    tenantId: "tenant-1",
    meterId: "api_calls",
    value: 5,
    timestamp: new Date("2024-01-15T10:30:00Z"),
    idempotencyKey,
  });

  beforeEach(() => {
    mockRedis = {
      zadd: vi.fn().mockResolvedValue(1),
      zrangebyscore: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue("OK"),
      eval: vi.fn(),
    };
    storage = new RedisUsageStorage(mockRedis);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createScanDeleteRedis(initialKeys: string[]): {
    keyspace: Set<string>;
    redis: RedisClient;
    scripts: string[];
  } {
    const keyspace = new Set(initialKeys);
    const scripts: string[] = [];
    const snapshots = new Map<string, string[]>();
    const redis: RedisClient = {
      zadd: vi.fn().mockResolvedValue(1),
      zrangebyscore: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue("OK"),
      async eval<TResult extends unknown[]>(
        script: string,
        keys: string[],
        args: Array<string | number>,
      ): Promise<TResult> {
        scripts.push(script);
        expect(keys).toEqual([]);

        const cursor = Number(args[0]);
        const pattern = String(args[1]);
        const snapshot =
          snapshots.get(pattern) ??
          Array.from(keyspace)
            .filter((key) => redisGlobToRegExp(pattern).test(key))
            .sort();
        snapshots.set(pattern, snapshot);

        const batch = snapshot.slice(cursor, cursor + 1);
        for (const key of batch) {
          keyspace.delete(key);
        }

        const nextCursor = cursor + 1 < snapshot.length ? String(cursor + 1) : "0";
        return [nextCursor, batch.length] as TResult;
      },
    };

    return { keyspace, redis, scripts };
  }

  function redisGlobToRegExp(pattern: string): RegExp {
    let source = "^";

    for (let index = 0; index < pattern.length; index += 1) {
      const char = pattern[index] ?? "";

      if (char === "\\") {
        index += 1;
        source += escapeRegExp(pattern[index] ?? "\\");
      } else if (char === "*") {
        source += ".*";
      } else if (char === "?") {
        source += ".";
      } else {
        source += escapeRegExp(char);
      }
    }

    return new RegExp(`${source}$`);
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  }

  describe("record", () => {
    it("should store usage in Redis sorted set", async () => {
      const usage: UsageRecord = {
        id: "usage-123",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "key-123",
      };

      await storage.record(usage);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "usage2:tenant-1:api_calls:2024-01",
        usage.timestamp.getTime(),
        expect.stringMatching(/^usage-123:5:v2\./),
      );
    });

    it("should keep colliding tenant and meter tuples in distinct usage and dedupe keys", async () => {
      const first = {
        ...createUsageRecord("request:*?[]"),
        tenantId: "a:b",
        meterId: "c",
      };
      const second = {
        ...createUsageRecord("request:*?[]"),
        tenantId: "a",
        meterId: "b:c",
      };
      const third = {
        ...createUsageRecord(""),
        tenantId: "tenant*[α]?\\",
        meterId: "",
      };

      await storage.record(first);
      await storage.record(second);
      await storage.record(third);

      const usageKeys = vi.mocked(mockRedis.zadd).mock.calls.map(([key]) => key);
      const dedupeKeys = vi.mocked(mockRedis.set).mock.calls.map(([key]) => key);
      expect(new Set(usageKeys)).toHaveLength(3);
      expect(new Set(dedupeKeys)).toHaveLength(3);
      expect(usageKeys.every((key) => key.startsWith("usage2:"))).toBe(true);
      expect(dedupeKeys.every((key) => key.startsWith("idem2:"))).toBe(true);
      expect(
        [...usageKeys, ...dedupeKeys].every(
          (key) => !key.includes("*") && !key.includes("?") && !key.includes("["),
        ),
      ).toBe(true);
    });

    it("should keep lifecycle and record idempotency state in distinct keys", async () => {
      const manager = new IdempotencyManager(mockRedis);
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      await manager.beginProcessing("tenant-1", "api_calls", "request-1");
      await storage.record(createUsageRecord("request-1"));

      const lifecycleKey = vi.mocked(mockRedis.eval).mock.calls[0]?.[1][0];
      const recordKey = vi.mocked(mockRedis.set).mock.calls[0]?.[0];
      expect(lifecycleKey).toBe("idem2:lifecycle:tenant-1:api_calls:request-1");
      expect(recordKey).toBe("idem2:record:tenant-1:api_calls:request-1");
      expect(recordKey).not.toBe(lifecycleKey);
    });

    it("should delete v2 records after nested envelope keys are reordered", async () => {
      const timestamp = new Date("2024-01-15T10:30:00Z");
      const recorded: UsageRecord = {
        id: "usage-stable",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp,
        idempotencyKey: "key-stable",
        dimensions: { model: "gpt-5", cached: false },
        metadata: { route: "/generate", nested: { beta: 2, alpha: 1 } },
      };

      await storage.record(recorded);
      const recordedMember = vi.mocked(mockRedis.zadd).mock.calls[0]?.[2];
      await storage.deleteUsageRecords(
        {
          tenantId: "tenant-1",
          meterId: "api_calls",
          period: "billing_cycle",
          startDate: timestamp,
          endDate: timestamp,
        },
        [
          {
            ...recorded,
            dimensions: { cached: false, model: "gpt-5" },
            metadata: { nested: { alpha: 1, beta: 2 }, route: "/generate" },
          },
        ],
      );

      expect(vi.mocked(mockRedis.eval).mock.calls.at(-1)?.[2]).toContain(recordedMember);
    });

    it("should preserve native JSON conversion while stabilizing envelope keys", async () => {
      const selfReturning = {
        value: "kept",
        toJSON() {
          return this;
        },
      };
      const record: UsageRecord = {
        id: "usage-json",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "key-json",
        metadata: { boxed: new Number(7), selfReturning },
      };

      await storage.record(record);

      const member = String(vi.mocked(mockRedis.zadd).mock.calls[0]?.[2]);
      const envelope = JSON.parse(decodeURIComponent(member.split(":v2.")[1] ?? ""));
      expect(envelope.metadata).toEqual({
        boxed: 7,
        selfReturning: { value: "kept" },
      });
    });

    it("should skip duplicate records with the same idempotency key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

      const usage: UsageRecord = {
        id: "usage-123",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "key-123",
      };

      await storage.record(usage);
      await storage.record({ ...usage, id: "usage-456" });

      expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
    });

    it("should throw RedisProblem on error", async () => {
      vi.mocked(mockRedis.zadd).mockRejectedValue(new Error("Connection refused"));

      const usage: UsageRecord = {
        id: "usage-123",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp: new Date(),
        idempotencyKey: "key-123",
      };

      await expect(storage.record(usage)).rejects.toThrow(RedisProblem);
    });

    it("should preserve string Redis rejection diagnostics", async () => {
      vi.mocked(mockRedis.zadd).mockRejectedValue("BUSY loading Redis dataset");

      const request = storage.record(createUsageRecord("key-123"));

      await expect(request).rejects.toThrow(RedisProblem);
      await expect(request).rejects.toMatchObject({
        detail: expect.stringContaining("BUSY loading Redis dataset"),
        extensions: { originalMessage: "BUSY loading Redis dataset" },
      });
    });

    it("should label idempotency failures as SET errors", async () => {
      vi.mocked(mockRedis.set).mockRejectedValue(new Error("SET failed"));

      const request = storage.record(createUsageRecord("key-123"));

      await expect(request).rejects.toThrow(RedisProblem);
      await expect(request).rejects.toMatchObject({
        detail: expect.stringContaining("Redis operation 'SET' failed"),
        extensions: { operation: "SET", originalMessage: "SET failed" },
      });
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });
  });

  describe("getUsage", () => {
    it("should sum values from Redis", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue(["usage-1:5", "usage-2:3", "usage-3:2"]);

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      };

      const result = await storage.getUsage(options);

      expect(result).toBe(10);
    });

    it("should query the requested period before falling back", async () => {
      vi.mocked(mockRedis.zrangebyscore)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["usage-1:5"]);

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      };

      const result = await storage.getUsage(options);

      expect(result).toBe(5);
      expect(mockRedis.zrangebyscore).toHaveBeenNthCalledWith(
        1,
        "usage2:tenant-1:api_calls:2024-01-15",
        expect.any(Number),
        expect.any(Number),
      );
      expect(mockRedis.zrangebyscore).toHaveBeenNthCalledWith(
        2,
        "usage2:tenant-1:api_calls:2024-01",
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("should return 0 for empty result", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([]);

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
      };

      const result = await storage.getUsage(options);

      expect(result).toBe(0);
    });

    it("should fall back to billing cycle data when a period-specific key is empty", async () => {
      vi.mocked(mockRedis.zrangebyscore)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["usage-1:5"]);

      const result = await storage.getUsage({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      });

      expect(result).toBe(5);
      expect(mockRedis.zrangebyscore).toHaveBeenNthCalledWith(
        1,
        "usage2:tenant-1:api_calls:2024-01-15",
        new Date("2024-01-15T00:00:00Z").getTime(),
        new Date("2024-01-15T23:59:59Z").getTime(),
      );
      expect(mockRedis.zrangebyscore).toHaveBeenNthCalledWith(
        2,
        "usage2:tenant-1:api_calls:2024-01",
        new Date("2024-01-15T00:00:00Z").getTime(),
        new Date("2024-01-15T23:59:59Z").getTime(),
      );
    });

    it("should throw RedisProblem on error", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockRejectedValue(new Error("Timeout"));

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
      };

      await expect(storage.getUsage(options)).rejects.toThrow(RedisProblem);
    });
  });

  describe("isIdempotent", () => {
    it("should return true for new key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      const result = await storage.isIdempotent("tenant-1", "api_calls", "key-123", 86400);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "idem2:record:tenant-1:api_calls:key-123",
        "1",
        "NX",
        "EX",
        86400,
      );
    });

    it("should return false for duplicate key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      const result = await storage.isIdempotent("tenant-1", "api_calls", "existing-key", 86400);

      expect(result).toBe(false);
    });

    it("should throw RedisProblem on error", async () => {
      vi.mocked(mockRedis.set).mockRejectedValue(new Error("Connection lost"));

      await expect(storage.isIdempotent("tenant-1", "api_calls", "key-123", 86400)).rejects.toThrow(
        RedisProblem,
      );
    });
  });

  describe("fetchUsageRecords", () => {
    it("should return parsed usage records with timestamps restored from Redis scores", async () => {
      const firstTimestamp = new Date("2024-01-15T10:30:00Z");
      const secondTimestamp = new Date("2024-01-15T11:45:00Z");
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([
        "usage-1:5",
        String(firstTimestamp.getTime()),
        "usage-2:3",
        String(secondTimestamp.getTime()),
      ]);
      const startDate = new Date("2024-01-15T00:00:00Z");
      const endDate = new Date("2024-01-15T23:59:59Z");

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate,
        endDate,
      };

      const result = await storage.fetchUsageRecords(options);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("usage-1");
      expect(result[0].value).toBe(5);
      expect(result[0].timestamp).toEqual(firstTimestamp);
      expect(result[1].id).toBe("usage-2");
      expect(result[1].value).toBe(3);
      expect(result[1].timestamp).toEqual(secondTimestamp);
      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
        "usage2:tenant-1:api_calls:2024-01-15",
        startDate.getTime(),
        endDate.getTime(),
        "WITHSCORES",
      );
    });

    it("should preserve metadata when fetching usage records", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([
        "usage-1:5:%7B%22endpoint%22%3A%22%2Fusers%22%2C%22nested%22%3A%7B%22active%22%3Atrue%7D%7D",
        String(new Date("2024-01-15T10:30:00Z").getTime()),
      ]);

      const result = await storage.fetchUsageRecords({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "billing_cycle",
      });

      expect(result).toHaveLength(1);
      expect(result[0].metadata).toEqual({
        endpoint: "/users",
        nested: { active: true },
      });
    });

    it("should preserve metadata when records are fetched", async () => {
      const metadata = encodeURIComponent(JSON.stringify({ source: "api", version: "v2" }));
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([
        `usage-1:5:${metadata}`,
        String(new Date("2024-01-15T10:30:00Z").getTime()),
      ]);

      const result = await storage.fetchUsageRecords({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      });

      expect(result[0].metadata).toEqual({ source: "api", version: "v2" });
    });

    it("should round-trip typed billing identity and dimensions separately from metadata", async () => {
      const usage: UsageRecord = {
        id: "usage-billable",
        tenantId: "tenant-1",
        meterId: "ai.tokens",
        value: 42,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "request-1",
        eventId: "request-1",
        dimensions: { model: "gpt-5", cached: false },
        metadata: { route: "/generate" },
      };

      await storage.record(usage);
      const member = vi.mocked(mockRedis.zadd).mock.calls[0]?.[2];
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([
        String(member),
        String(usage.timestamp.getTime()),
      ]);

      const [restored] = await storage.fetchUsageRecords({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        period: "billing_cycle",
      });

      expect(restored).toEqual(usage);
    });

    it("should return empty array when no records", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([]);

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
      };

      const result = await storage.fetchUsageRecords(options);

      expect(result).toEqual([]);
    });

    it("should throw RedisProblem when Redis omits scores for fetched records", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue(["usage-1:5"]);

      const request = storage.fetchUsageRecords({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      });

      await expect(request).rejects.toThrow(RedisProblem);
      await expect(request).rejects.toMatchObject({
        code: "metering/redis-error",
        detail: expect.stringContaining("WITHSCORES returned an odd number of values"),
      });
    });

    it("should throw RedisProblem when Redis returns invalid usage scores", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue(["usage-1:5", "not-a-score"]);

      await expect(
        storage.fetchUsageRecords({
          tenantId: "tenant-1",
          meterId: "api_calls",
          period: "day",
          startDate: new Date("2024-01-15T00:00:00Z"),
          endDate: new Date("2024-01-15T23:59:59Z"),
        }),
      ).rejects.toThrow(RedisProblem);
    });

    it("should remove flushed records from Redis", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      const records: UsageRecord[] = [
        {
          id: "usage-1",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          timestamp: new Date("2024-01-15T10:30:00Z"),
          idempotencyKey: "idem-1",
          metadata: { endpoint: "/users" },
        },
      ];

      await storage.deleteUsageRecords?.(
        {
          tenantId: "tenant-1",
          meterId: "api_calls",
          period: "billing_cycle",
          startDate: new Date("2024-01-15T00:00:00Z"),
          endDate: new Date("2024-01-15T23:59:59Z"),
        },
        records,
      );

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("ZREM"),
        ["usage2:tenant-1:api_calls:2024-01"],
        expect.arrayContaining([
          expect.stringMatching(/^usage-1:5:v2\./),
          "usage-1:5:%7B%22endpoint%22%3A%22%2Fusers%22%7D",
        ]),
      );
    });
  });

  describe("checkAndRecordWithinQuota", () => {
    it("should call redis.eval with atomic quota script arguments", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, 8]);

      const usage: UsageRecord = {
        id: "usage-123",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "key-123",
      };

      const result = await storage.checkAndRecordWithinQuota({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        value: usage.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord: usage,
      });

      expect(result).toEqual({ exceeded: false, newUsage: 8 });
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('ZRANGEBYSCORE'"),
        ["usage2:tenant-1:api_calls:2024-01"],
        [10, 5, usage.timestamp.getTime(), expect.stringMatching(/^usage-123:5:v2\./), 0],
      );
    });

    it("should map exceeded result from redis.eval", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, 12]);

      const result = await storage.checkAndRecordWithinQuota({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 4,
        quota: 10,
        allowOverQuota: true,
        usageRecord: {
          id: "usage-123",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 4,
          timestamp: new Date("2024-01-15T10:30:00Z"),
          idempotencyKey: "key-123",
        },
      });

      expect(result).toEqual({ exceeded: true, newUsage: 12 });
    });

    it("should not double count the same idempotency key", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValueOnce([0, 8]);
      vi.mocked(mockRedis.set).mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue(["usage-1:5", "usage-2:3"]);

      const usageRecord: UsageRecord = {
        id: "usage-123",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        timestamp: new Date("2024-01-15T10:30:00Z"),
        idempotencyKey: "key-123",
      };

      const first = await storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });
      const second = await storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord: { ...usageRecord, id: "usage-456" },
      });

      expect(first).toEqual({ exceeded: false, newUsage: 8 });
      expect(second).toEqual({ exceeded: false, newUsage: 8 });
    });

    it("should prune expired local record idempotency keys during later quota writes", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
      vi.mocked(mockRedis.eval).mockResolvedValue([0, 5]);

      const firstRecord = createUsageRecord("key-1");
      await storage.checkAndRecordWithinQuota({
        tenantId: firstRecord.tenantId,
        meterId: firstRecord.meterId,
        value: firstRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord: firstRecord,
      });

      expect(getRecordedRecordKeys().has("idem2:record:tenant-1:api_calls:key-1")).toBe(true);

      vi.setSystemTime(new Date("2024-01-02T00:00:01.000Z"));

      const secondRecord = createUsageRecord("key-2");
      await storage.checkAndRecordWithinQuota({
        tenantId: secondRecord.tenantId,
        meterId: secondRecord.meterId,
        value: secondRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord: secondRecord,
      });

      expect(getRecordedRecordKeys().has("idem2:record:tenant-1:api_calls:key-1")).toBe(false);
      expect(getRecordedRecordKeys().has("idem2:record:tenant-1:api_calls:key-2")).toBe(true);
      expect(getRecordedRecordKeys().size).toBe(1);
    });

    it("should cap the local record idempotency cache size", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, 5]);

      for (let index = 0; index <= 10_000; index += 1) {
        const usageRecord = createUsageRecord(`key-${index}`);

        await storage.checkAndRecordWithinQuota({
          tenantId: usageRecord.tenantId,
          meterId: usageRecord.meterId,
          value: usageRecord.value,
          quota: 10,
          allowOverQuota: false,
          usageRecord,
        });
      }

      expect(getRecordedRecordKeys().size).toBe(10_000);
      expect(getRecordedRecordKeys().has("idem2:record:tenant-1:api_calls:key-0")).toBe(false);
      expect(getRecordedRecordKeys().has("idem2:record:tenant-1:api_calls:key-10000")).toBe(true);
    });

    it("should throw RedisProblem on eval error", async () => {
      vi.mocked(mockRedis.eval).mockRejectedValue(new Error("Script failed"));

      await expect(
        storage.checkAndRecordWithinQuota({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 4,
          quota: 10,
          allowOverQuota: false,
          usageRecord: {
            id: "usage-123",
            tenantId: "tenant-1",
            meterId: "api_calls",
            value: 4,
            timestamp: new Date("2024-01-15T10:30:00Z"),
            idempotencyKey: "key-123",
          },
        }),
      ).rejects.toThrow(RedisProblem);
    });

    it("should label cached idempotency reads as ZRANGEBYSCORE errors", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValueOnce([0, 8]);
      vi.mocked(mockRedis.zrangebyscore).mockRejectedValue(new Error("Read failed"));

      const usageRecord = createUsageRecord("key-123");

      await storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });

      const request = storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 10,
        allowOverQuota: false,
        usageRecord: { ...usageRecord, id: "usage-456" },
      });

      await expect(request).rejects.toThrow(RedisProblem);
      await expect(request).rejects.toMatchObject({
        detail: expect.stringContaining("Redis operation 'ZRANGEBYSCORE' failed"),
        extensions: { operation: "ZRANGEBYSCORE", originalMessage: "Read failed" },
      });
    });
  });

  describe("deleteUsageRecords", () => {
    it("should remove flushed records from Redis", async () => {
      const records: UsageRecord[] = [
        {
          id: "usage-1",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          timestamp: new Date("2024-01-15T10:30:00Z"),
          idempotencyKey: "key-1",
          metadata: { source: "api" },
        },
        {
          id: "usage-2",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 3,
          timestamp: new Date("2024-01-15T11:30:00Z"),
          idempotencyKey: "key-2",
        },
      ];

      await storage.deleteUsageRecords(
        {
          tenantId: "tenant-1",
          meterId: "api_calls",
          period: "day",
          startDate: new Date("2024-01-15T00:00:00Z"),
          endDate: new Date("2024-01-15T23:59:59Z"),
        },
        records,
      );

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("ZREM"),
        ["usage2:tenant-1:api_calls:2024-01-15"],
        expect.arrayContaining([
          expect.stringMatching(/^usage-1:5:v2\./),
          expect.stringMatching(/^usage-2:3:v2\./),
          "usage-1:5:%7B%22source%22%3A%22api%22%7D",
          "usage-2:3",
        ]),
      );
    });

    it("should delete records written with the legacy member format", async () => {
      const timestamp = new Date("2024-01-15T10:30:00Z");
      const legacyMember = "usage-legacy:5:%7B%22source%22%3A%22api%22%7D";
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue([
        legacyMember,
        String(timestamp.getTime()),
      ]);

      const records = await storage.fetchUsageRecords({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "billing_cycle",
        startDate: timestamp,
        endDate: timestamp,
      });
      await storage.deleteUsageRecords(
        {
          tenantId: "tenant-1",
          meterId: "api_calls",
          period: "billing_cycle",
          startDate: timestamp,
          endDate: timestamp,
        },
        records,
      );

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("ZREM"),
        ["usage2:tenant-1:api_calls:2024-01"],
        expect.arrayContaining([legacyMember]),
      );
    });
  });

  describe("resetBillingCycle", () => {
    it("should delete a single meter billing cycle key directly", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

      await storage.resetBillingCycle("tenant-1", "api_calls");

      expect(mockRedis.eval).toHaveBeenCalledWith(
        'return redis.call("DEL", KEYS[1])',
        ["usage2:tenant-1:api_calls:2024-01"],
        [],
      );
    });

    it("should treat an empty meter ID as a concrete encoded segment", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

      await storage.resetBillingCycle("tenant*[α]?\\", "");

      expect(mockRedis.eval).toHaveBeenCalledWith(
        'return redis.call("DEL", KEYS[1])',
        ["usage2:tenant%002A%005B%03B1%005D%003F%005C::2024-01"],
        [],
      );
    });

    it("should reset tenant billing cycle usage with bounded SCAN batches instead of KEYS", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));
      vi.mocked(mockRedis.eval).mockResolvedValueOnce(["7", 2]).mockResolvedValueOnce(["0", 1]);

      await storage.resetBillingCycle("tenant-1");

      expect(mockRedis.eval).toHaveBeenCalledTimes(2);
      const [firstScript, firstKeys, firstArgs] = vi.mocked(mockRedis.eval).mock.calls[0];
      const [secondScript, secondKeys, secondArgs] = vi.mocked(mockRedis.eval).mock.calls[1];

      expect(firstScript).toContain("redis.call('SCAN'");
      expect(firstScript).not.toContain("redis.call('KEYS'");
      expect(firstKeys).toEqual([]);
      expect(firstArgs).toEqual(["0", "usage2:tenant-1:*:2024-01", 500]);
      expect(secondScript).toBe(firstScript);
      expect(secondKeys).toEqual([]);
      expect(secondArgs).toEqual(["7", "usage2:tenant-1:*:2024-01", 500]);
    });

    it("should delete only current tenant billing cycle keys from a Redis-like keyspace", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));
      const { keyspace, redis, scripts } = createScanDeleteRedis([
        "usage2:tenant-1:api_calls:2024-01",
        "usage2:tenant-1:storage:2024-01",
        "usage2:tenant-1:api_calls:2024-02",
        "usage2:tenant-2:api_calls:2024-01",
        "idem2:record:tenant-1:api_calls:key-1",
      ]);
      const redisBackedStorage = new RedisUsageStorage(redis);

      await redisBackedStorage.resetBillingCycle("tenant-1");

      expect(Array.from(keyspace).sort()).toEqual([
        "idem2:record:tenant-1:api_calls:key-1",
        "usage2:tenant-1:api_calls:2024-02",
        "usage2:tenant-2:api_calls:2024-01",
      ]);
      expect(scripts).toHaveLength(2);
      expect(scripts.every((script) => script.includes("redis.call('SCAN'"))).toBe(true);
      expect(scripts.every((script) => !script.includes("redis.call('KEYS'"))).toBe(true);
    });

    it("should escape tenant glob metacharacters in tenant-wide reset patterns", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));
      vi.mocked(mockRedis.eval).mockResolvedValue(["0", 0]);

      await storage.resetBillingCycle("tenant*[alpha]?\\");

      const [, , args] = vi.mocked(mockRedis.eval).mock.calls[0];
      expect(args).toEqual(["0", "usage2:tenant%002A%005Balpha%005D%003F%005C:*:2024-01", 500]);
    });
  });

  describe("time range calculation", () => {
    it("should use provided date range", async () => {
      const startDate = new Date("2024-01-15T00:00:00Z");
      const endDate = new Date("2024-01-15T23:59:59Z");

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate,
        endDate,
      };

      await storage.getUsage(options);

      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
        expect.any(String),
        startDate.getTime(),
        endDate.getTime(),
      );
    });
  });
});
