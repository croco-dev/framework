import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import type { IdempotencyClaim } from "../libs/IdempotencyManager";
import type { RedisClient } from "../libs/RedisClient";

function createLeaseRedis(): {
  redis: RedisClient;
  advanceSeconds(seconds: number): void;
  read(key: string): string | null;
} {
  let nowSeconds = 0;
  const entries = new Map<string, { value: string; expiresAt: number }>();

  const read = (key: string): string | null => {
    const entry = entries.get(key);
    if (entry === undefined) {
      return null;
    }
    if (entry.expiresAt <= nowSeconds) {
      entries.delete(key);
      return null;
    }
    return entry.value;
  };

  const redis: RedisClient = {
    zadd: vi.fn(),
    zrangebyscore: vi.fn(),
    set: async (key, value, _mode, _expireMode, expire) => {
      if (read(key) !== null) {
        return null;
      }
      entries.set(key, { value, expiresAt: nowSeconds + expire });
      return "OK";
    },
    eval: async <TResult extends unknown[]>(
      script: string,
      keys: string[],
      args: Array<string | number>,
    ) => {
      const key = keys[0];
      if (key !== undefined && read(key) === args[0]) {
        if (script.includes("redis.call('DEL'")) {
          entries.delete(key);
        } else {
          entries.set(key, {
            value: String(args[1]),
            expiresAt: nowSeconds + Number(args[2]),
          });
        }
      }
      return [1] as unknown as TResult;
    },
  };

  return {
    redis,
    advanceSeconds(seconds: number): void {
      nowSeconds += seconds;
    },
    read,
  };
}

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
        "idem2:lifecycle:tenant-1:api_calls:key-123",
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
        "idem2:lifecycle:tenant-1:api_calls:key-123",
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
        "idem2:lifecycle:tenant-A:meter-X:same-key",
        "COMPLETED",
        "NX",
        "EX",
        86400,
      );
      expect(mockRedis.set).toHaveBeenNthCalledWith(
        2,
        "idem2:lifecycle:tenant-B:meter-X:same-key",
        "COMPLETED",
        "NX",
        "EX",
        86400,
      );
    });

    it("should keep ambiguous and special-character tuples in distinct keys", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await manager.checkAndMark("a:b", "c", "request:*?[]");
      await manager.checkAndMark("a", "b:c", "request:*?[]");
      await manager.checkAndMark("", "측정기:α", "");
      await manager.checkAndMark("\ud800", "", "");

      const keys = vi.mocked(mockRedis.set).mock.calls.map(([key]) => key);
      expect(new Set(keys)).toHaveLength(4);
      expect(keys.every((key) => key.startsWith("idem2:"))).toBe(true);
      expect(
        keys.every((key) => !key.includes("*") && !key.includes("?") && !key.includes("[")),
      ).toBe(true);
    });
  });

  describe("beginProcessing", () => {
    it("should return a unique claim for a new in-progress key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      const result = await manager.beginProcessing("tenant-1", "api_calls", "key-123");

      expect(result).toMatch(/^[0-9A-Z]{26}$/);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "idem2:lifecycle:tenant-1:api_calls:key-123",
        `IN_PROGRESS:${result}`,
        "NX",
        "EX",
        86400,
      );
    });

    it("should return null for duplicate key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      const result = await manager.beginProcessing("tenant-1", "api_calls", "existing-key");

      expect(result).toBeNull();
    });
  });

  describe("beginProcessingOrThrow", () => {
    it("should throw DuplicateRecordProblem for duplicate key", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      await expect(
        manager.beginProcessingOrThrow("tenant-1", "api_calls", "duplicate-key"),
      ).rejects.toThrow(DuplicateRecordProblem);
    });
  });

  describe("completeProcessing", () => {
    it("should mark in-progress key as completed", async () => {
      const claim = "claim-1" as IdempotencyClaim;
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      await manager.completeProcessing("tenant-1", "api_calls", "key-123", claim);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])"),
        ["idem2:lifecycle:tenant-1:api_calls:key-123"],
        ["IN_PROGRESS:claim-1", "COMPLETED", "86400"],
      );
    });
  });

  describe("abortProcessing", () => {
    it("should delete in-progress key", async () => {
      const claim = "claim-1" as IdempotencyClaim;
      vi.mocked(mockRedis.eval).mockResolvedValue([1]);

      await manager.abortProcessing("tenant-1", "api_calls", "key-123", claim);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('DEL', KEYS[1])"),
        ["idem2:lifecycle:tenant-1:api_calls:key-123"],
        ["IN_PROGRESS:claim-1"],
      );
    });
  });

  it("should fence stale completion and abort after expiry and reacquisition", async () => {
    const leaseRedis = createLeaseRedis();
    const expiringManager = new IdempotencyManager(leaseRedis.redis, 1);
    const key = "idem2:lifecycle:tenant-1:api_calls:key-123";

    const staleClaim = await expiringManager.beginProcessingOrThrow(
      "tenant-1",
      "api_calls",
      "key-123",
    );

    leaseRedis.advanceSeconds(1);
    const currentClaim = await expiringManager.beginProcessingOrThrow(
      "tenant-1",
      "api_calls",
      "key-123",
    );
    expect(currentClaim).not.toBe(staleClaim);
    expect(leaseRedis.read(key)).toBe(`IN_PROGRESS:${currentClaim}`);

    await expiringManager.completeProcessing("tenant-1", "api_calls", "key-123", staleClaim);
    expect(leaseRedis.read(key)).toBe(`IN_PROGRESS:${currentClaim}`);

    await expiringManager.abortProcessing("tenant-1", "api_calls", "key-123", staleClaim);
    expect(leaseRedis.read(key)).toBe(`IN_PROGRESS:${currentClaim}`);

    await expiringManager.completeProcessing("tenant-1", "api_calls", "key-123", currentClaim);
    expect(leaseRedis.read(key)).toBe("COMPLETED");
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
