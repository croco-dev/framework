import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import { MeteringTransitionProblem } from "../libs/problems/MeteringTransitionProblem";
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
    scriptKeyAccess: "multi-key",
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

function createStagedRedis(): {
  redis: RedisClient;
  expireLease(): void;
  readState(): { status: string; token?: string } | undefined;
} {
  let leaseExpired = false;
  let lifecycleValue: string | undefined;
  let state:
    | {
        status: "PROCESSING" | "PUBLISHING" | "EVENTS_PENDING" | "COMPLETED";
        token?: string;
        operationId?: string;
        delivery?: string;
      }
    | undefined;

  const redis: RedisClient = {
    scriptKeyAccess: "multi-key",
    zadd: vi.fn(),
    zrangebyscore: vi.fn(),
    set: vi.fn(),
    eval: async <TResult extends unknown[]>(
      script: string,
      _keys: string[],
      args: Array<string | number>,
    ) => {
      if (script.includes("state.status == 'EVENTS_PENDING'")) {
        const token = String(args[0]);
        const operationId = String(args[3]);
        if (!state) {
          state = { status: "PROCESSING", token, operationId };
          lifecycleValue = String(args[6]);
          return [1, "", operationId] as unknown as TResult;
        }
        if (
          state.status === "EVENTS_PENDING" ||
          ((state.status === "PROCESSING" || state.status === "PUBLISHING") && leaseExpired)
        ) {
          state.status = state.delivery ? "PUBLISHING" : "PROCESSING";
          state.token = token;
          state.operationId ??= operationId;
          lifecycleValue = String(args[6]);
          leaseExpired = false;
          return [1, state.delivery ?? "", state.operationId] as unknown as TResult;
        }
        return [0, "", ""] as unknown as TResult;
      }

      if (script.includes("state.delivery = ARGV[2]")) {
        if (!state) {
          return [0, "MISSING"] as unknown as TResult;
        }
        if (state.status !== "PROCESSING") {
          return [0, `STATUS:${state.status}`] as unknown as TResult;
        }
        if (state.token !== String(args[0])) {
          return [0, "TOKEN"] as unknown as TResult;
        }
        state.status = "PUBLISHING";
        state.delivery = String(args[1]);
        return [1, "OK"] as unknown as TResult;
      }

      if (script.includes("state.leaseExpiresAt = 0")) {
        if (!state) {
          return [0, "MISSING"] as unknown as TResult;
        }
        if (state.status !== "PROCESSING") {
          return [0, `STATUS:${state.status}`] as unknown as TResult;
        }
        if (state.token !== String(args[0])) {
          return [0, "TOKEN"] as unknown as TResult;
        }
        delete state.token;
        leaseExpired = true;
        return [1, "OK"] as unknown as TResult;
      }

      if (script.includes("state.status = 'EVENTS_PENDING'")) {
        if (!state) {
          return [0, "MISSING"] as unknown as TResult;
        }
        if (state.status === "COMPLETED") {
          return [1, "ALREADY_COMPLETED"] as unknown as TResult;
        }
        if (state.status !== "PUBLISHING") {
          return [0, `STATUS:${state.status}`] as unknown as TResult;
        }
        if (state.token !== String(args[0])) {
          return [0, "TOKEN"] as unknown as TResult;
        }

        state.status = "EVENTS_PENDING";
        delete state.token;
        return [1, "OK"] as unknown as TResult;
      }

      if (script.includes('{"status":"COMPLETED"}')) {
        if (!state) {
          return [0, "MISSING"] as unknown as TResult;
        }
        if (state.status === "COMPLETED") {
          return [1, "ALREADY_COMPLETED"] as unknown as TResult;
        }
        if (state.status !== "PUBLISHING") {
          return [0, `STATUS:${state.status}`] as unknown as TResult;
        }
        if (state.token !== String(args[0])) {
          return [0, "TOKEN"] as unknown as TResult;
        }
        state = { status: "COMPLETED" };
        lifecycleValue = String(args[2]);
        return [1, "OK"] as unknown as TResult;
      }

      if (script.includes("redis.call('DEL', KEYS[2])")) {
        if (!state) {
          return [0, "MISSING"] as unknown as TResult;
        }
        if (state.status !== "PROCESSING") {
          return [0, `STATUS:${state.status}`] as unknown as TResult;
        }
        if (state.token !== String(args[0])) {
          return [0, "TOKEN"] as unknown as TResult;
        }
        if (lifecycleValue !== String(args[1])) {
          return [0, "LIFECYCLE"] as unknown as TResult;
        }

        state = undefined;
        lifecycleValue = undefined;
        return [1, "OK"] as unknown as TResult;
      }

      throw new Error(`Unsupported staged redis script: ${script}`);
    },
  };

  return {
    redis,
    expireLease(): void {
      leaseExpired = true;
    },
    readState() {
      return state ? { status: state.status, token: state.token } : undefined;
    },
  };
}

describe("IdempotencyManager", () => {
  let manager!: IdempotencyManager;
  let mockRedis!: RedisClient;

  beforeEach(() => {
    mockRedis = {
      scriptKeyAccess: "multi-key",
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
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "OK"]);

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

  describe("metering delivery state", () => {
    const deliveryClaim = "claim-token" as IdempotencyClaim;
    const delivery = {
      usageRecord: {
        id: "usage-1",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1,
        timestamp: "2026-07-30T00:00:00.000Z",
        idempotencyKey: "key-123",
      },
    };

    it("should claim a new processing lease", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "", "operation-1"]);

      const claim = await manager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );

      expect(claim.token).toMatch(/^[0-9A-Z]{26}$/);
      expect(claim.operationId).toBe("operation-1");
      expect(claim.delivery).toBeUndefined();
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("state.status == 'EVENTS_PENDING'"),
        ["idem2:delivery:tenant-1:api_calls:key-123", "idem2:lifecycle:tenant-1:api_calls:key-123"],
        [
          claim.token,
          30_000,
          86_400,
          expect.stringMatching(/^[0-9A-Z]{26}$/),
          "IN_PROGRESS:",
          "COMPLETED",
          `IN_PROGRESS:${claim.token}`,
        ],
      );
    });

    it("should restore a durably pending delivery when claiming its lease", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, JSON.stringify(delivery), "operation-1"]);

      const claim = await manager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );

      expect(claim.delivery).toEqual(delivery);
    });

    it("should preserve opaque delivery JSON across publication retries", async () => {
      const stagedRedis = createStagedRedis();
      const stagedManager = new IdempotencyManager(stagedRedis.redis, 60, 1_000);
      const firstClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );
      const opaqueDelivery = {
        ...delivery,
        usageRecord: {
          ...delivery.usageRecord,
          metadata: { empty: [], nested: { empty: [] } },
        },
      };

      await stagedManager.markMeteringEventsPublishing(
        "tenant-1",
        "api_calls",
        "key-123",
        firstClaim.token,
        opaqueDelivery,
      );
      await stagedManager.releaseMeteringEvents(
        "tenant-1",
        "api_calls",
        "key-123",
        firstClaim.token,
      );

      const retryClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );
      expect(retryClaim.delivery).toEqual(opaqueDelivery);
    });

    it("should immediately release processing for safe persistence replay", async () => {
      const stagedRedis = createStagedRedis();
      const stagedManager = new IdempotencyManager(stagedRedis.redis, 60, 1_000);
      const firstClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );

      await stagedManager.releaseMeteringProcessing(
        "tenant-1",
        "api_calls",
        "key-123",
        firstClaim.token,
      );
      const retryClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );

      expect(retryClaim.operationId).toBe(firstClaim.operationId);
      expect(retryClaim.token).not.toBe(firstClaim.token);
      expect(retryClaim.delivery).toBeUndefined();
    });

    it("should reject a delivery lease held by another caller", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, "", ""]);

      await expect(
        manager.claimMeteringProcessingOrThrow("tenant-1", "api_calls", "key-123"),
      ).rejects.toThrow(DuplicateRecordProblem);
    });

    it("should persist canonical delivery before publication", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "OK"]);

      await manager.markMeteringEventsPublishing(
        "tenant-1",
        "api_calls",
        "key-123",
        deliveryClaim,
        delivery,
      );

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("state.status = 'PUBLISHING'"),
        ["idem2:delivery:tenant-1:api_calls:key-123"],
        [deliveryClaim, JSON.stringify(delivery), 30_000, 86_400],
      );
    });

    it("should reject a stale publisher transition", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, "TOKEN"]);

      const transition = expect(
        manager.markMeteringEventsPublishing(
          "tenant-1",
          "api_calls",
          "key-123",
          "stale-token" as IdempotencyClaim,
          delivery,
        ),
      ).rejects;

      await transition.toThrow(MeteringTransitionProblem);
      await transition.toMatchObject({
        code: "metering/transition-conflict",
        extensions: {
          idempotencyKey: "key-123",
          reason: "TOKEN",
          transition: "mark-events-publishing",
        },
      });
    });

    it("should release failed publication for an exclusive retry", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "OK"]);

      await manager.releaseMeteringEvents("tenant-1", "api_calls", "key-123", deliveryClaim);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("state.status = 'EVENTS_PENDING'"),
        ["idem2:delivery:tenant-1:api_calls:key-123"],
        [deliveryClaim, 86_400],
      );
    });

    it("should complete only the current publication claim", async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "OK"]);

      await manager.completeMeteringProcessing("tenant-1", "api_calls", "key-123", deliveryClaim);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining(`'{"status":"COMPLETED"}'`),
        ["idem2:delivery:tenant-1:api_calls:key-123", "idem2:lifecycle:tenant-1:api_calls:key-123"],
        [deliveryClaim, 86_400, "COMPLETED"],
      );
    });

    it("should keep active state alive longer than its processing lease", async () => {
      manager = new IdempotencyManager(mockRedis, 1, 30_000);
      vi.mocked(mockRedis.eval).mockResolvedValue([1, "", "operation-1"]);

      await manager.claimMeteringProcessingOrThrow("tenant-1", "api_calls", "key-123");

      expect(vi.mocked(mockRedis.eval).mock.calls[0]?.[2][2]).toBe(31);
    });

    it("should fence every stale staged transition after lease reacquisition", async () => {
      const stagedRedis = createStagedRedis();
      const stagedManager = new IdempotencyManager(stagedRedis.redis, 60, 1_000);
      const firstClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );
      stagedRedis.expireLease();
      const currentClaim = await stagedManager.claimMeteringProcessingOrThrow(
        "tenant-1",
        "api_calls",
        "key-123",
      );

      expect(currentClaim.token).not.toBe(firstClaim.token);
      await expect(
        stagedManager.markMeteringEventsPublishing(
          "tenant-1",
          "api_calls",
          "key-123",
          firstClaim.token,
          delivery,
        ),
      ).rejects.toThrow(MeteringTransitionProblem);
      await expect(
        stagedManager.abortMeteringProcessing("tenant-1", "api_calls", "key-123", firstClaim.token),
      ).rejects.toThrow(MeteringTransitionProblem);
      expect(stagedRedis.readState()).toEqual({
        status: "PROCESSING",
        token: currentClaim.token,
      });

      await stagedManager.markMeteringEventsPublishing(
        "tenant-1",
        "api_calls",
        "key-123",
        currentClaim.token,
        delivery,
      );
      await expect(
        stagedManager.releaseMeteringEvents("tenant-1", "api_calls", "key-123", firstClaim.token),
      ).rejects.toThrow(MeteringTransitionProblem);
      await expect(
        stagedManager.completeMeteringProcessing(
          "tenant-1",
          "api_calls",
          "key-123",
          firstClaim.token,
        ),
      ).rejects.toThrow(MeteringTransitionProblem);
      expect(stagedRedis.readState()).toEqual({
        status: "PUBLISHING",
        token: currentClaim.token,
      });

      await stagedManager.completeMeteringProcessing(
        "tenant-1",
        "api_calls",
        "key-123",
        currentClaim.token,
      );
      expect(stagedRedis.readState()).toEqual({ status: "COMPLETED", token: undefined });

      await expect(
        stagedManager.releaseMeteringEvents("tenant-1", "api_calls", "key-123", currentClaim.token),
      ).resolves.toBeUndefined();
      expect(stagedRedis.readState()).toEqual({ status: "COMPLETED", token: undefined });
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
