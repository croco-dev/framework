import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisProblem } from "../libs/problems/RedisProblem";
import type { RedisClient } from "../libs/RedisClient";
import { RedisUsageStorage } from "../libs/RedisUsageStorage";
import type { UsageQueryOptions, UsageRecord } from "../libs/types";

describe("RedisUsageStorage", () => {
  let storage!: RedisUsageStorage;
  let mockRedis!: RedisClient;

  beforeEach(() => {
    mockRedis = {
      zadd: vi.fn().mockResolvedValue(1),
      zrangebyscore: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue("OK"),
      eval: vi.fn(),
    };
    storage = new RedisUsageStorage(mockRedis);
  });

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
        "usage:tenant-1:api_calls:2024-01",
        usage.timestamp.getTime(),
        "usage-123:5",
      );
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
        "idem:tenant-1:api_calls:key-123",
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
    it("should return parsed usage records", async () => {
      vi.mocked(mockRedis.zrangebyscore).mockResolvedValue(["usage-1:5", "usage-2:3"]);

      const options: UsageQueryOptions = {
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-15T23:59:59Z"),
      };

      const result = await storage.fetchUsageRecords(options);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("usage-1");
      expect(result[0].value).toBe(5);
      expect(result[1].id).toBe("usage-2");
      expect(result[1].value).toBe(3);
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
        ["usage:tenant-1:api_calls:2024-01"],
        [10, 5, usage.timestamp.getTime(), "usage-123:5", 0],
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
