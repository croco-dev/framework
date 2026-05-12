import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import type { RedisClient } from "../libs/RedisClient";

describe("IdempotencyManager", () => {
  let manager!: IdempotencyManager;
  let mockRedis!: RedisClient;

  beforeEach(() => {
    mockRedis = {
      zadd: vi.fn(),
      zrangebyscore: vi.fn(),
      set: vi.fn(),
      eval: vi.fn(),
    };
    manager = new IdempotencyManager(mockRedis);
  });

  describe("ensureIdempotencyKey", () => {
    it("should return provided key if given", () => {
      const result = manager.ensureIdempotencyKey("custom-key");
      expect(result).toBe("custom-key");
    });

    it("should generate ULID if no key provided", () => {
      const result = manager.ensureIdempotencyKey();
      expect(result).toMatch(/^[0-9A-Z]{26}$/);
    });

    it("should generate ULID if undefined provided", () => {
      const result = manager.ensureIdempotencyKey(undefined);
      expect(result).toMatch(/^[0-9A-Z]{26}$/);
    });

    it("should generate unique keys each time", () => {
      const key1 = manager.ensureIdempotencyKey();
      const key2 = manager.ensureIdempotencyKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("checkAndMark", () => {
    it("should return true for new key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      const result = await manager.checkAndMark("tenant-1", "api_calls", "key-123");

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "idem:tenant-1:api_calls:key-123",
        "COMPLETED",
        "NX",
        "EX",
        86400,
      );
    });

    it("should return false for duplicate key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      const result = await manager.checkAndMark("tenant-1", "api_calls", "existing-key");

      expect(result).toBe(false);
    });

    it("should use custom TTL", async () => {
      const customManager = new IdempotencyManager(mockRedis, 3600);
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await customManager.checkAndMark("tenant-1", "api_calls", "key-123");

      expect(mockRedis.set).toHaveBeenCalledWith(
        "idem:tenant-1:api_calls:key-123",
        "COMPLETED",
        "NX",
        "EX",
        3600,
      );
    });

    it("should include tenant and meter in key for isolation", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await manager.checkAndMark("tenant-A", "meter-X", "same-key");
      await manager.checkAndMark("tenant-B", "meter-X", "same-key");

      expect(mockRedis.set).toHaveBeenNthCalledWith(
        1,
        "idem:tenant-A:meter-X:same-key",
        "COMPLETED",
        "NX",
        "EX",
        86400,
      );
      expect(mockRedis.set).toHaveBeenNthCalledWith(
        2,
        "idem:tenant-B:meter-X:same-key",
        "COMPLETED",
        "NX",
        "EX",
        86400,
      );
    });
  });

  describe("beginProcessing", () => {
    it("should return true for new in-progress key", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      const result = await manager.beginProcessing("tenant-1", "api_calls", "key-123");

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])"),
        ["idem:tenant-1:api_calls:key-123"],
        ["IN_PROGRESS", "86400"],
      );
    });

    it("should return false for duplicate key", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0]);

      const result = await manager.beginProcessing("tenant-1", "api_calls", "existing-key");

      expect(result).toBe(false);
    });
  });

  describe("beginProcessingOrThrow", () => {
    it("should throw DuplicateRecordProblem for duplicate key", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0]);

      await expect(
        manager.beginProcessingOrThrow("tenant-1", "api_calls", "duplicate-key"),
      ).rejects.toThrow(DuplicateRecordProblem);
    });
  });

  describe("completeProcessing", () => {
    it("should mark in-progress key as completed", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      await manager.completeProcessing("tenant-1", "api_calls", "key-123");

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])"),
        ["idem:tenant-1:api_calls:key-123"],
        ["IN_PROGRESS", "COMPLETED", "86400"],
      );
    });
  });

  describe("abortProcessing", () => {
    it("should delete in-progress key", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      await manager.abortProcessing("tenant-1", "api_calls", "key-123");

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('DEL', KEYS[1])"),
        ["idem:tenant-1:api_calls:key-123"],
        ["IN_PROGRESS"],
      );
    });
  });

  describe("checkAndMarkOrThrow", () => {
    it("should not throw for new key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await expect(
        manager.checkAndMarkOrThrow("tenant-1", "api_calls", "key-123"),
      ).resolves.not.toThrow();
    });

    it("should throw DuplicateRecordProblem for duplicate key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      await expect(
        manager.checkAndMarkOrThrow("tenant-1", "api_calls", "duplicate-key"),
      ).rejects.toThrow(DuplicateRecordProblem);
    });

    it("should include idempotency key in error", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      try {
        await manager.checkAndMarkOrThrow("tenant-1", "api_calls", "my-dup-key");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DuplicateRecordProblem);
        expect((error as Error).message).toContain("my-dup-key");
      }
    });
  });
});
