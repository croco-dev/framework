import {
  redisResource,
  TestResourceLifecycleProblem,
  type RedisTestConnection,
} from "@croco/testing-resources";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, assert } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import type { BillableUsageClaim, BillableUsageEvent } from "../libs/BillableUsageJournal";
import { MeteringService } from "../libs/MeteringService";
import type { MeterRegistry } from "../libs/MeterRegistry";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import { RedisProblem } from "../libs/problems/RedisProblem";
import type { RedisClient } from "../libs/RedisClient";
import { RedisBillableUsageJournal } from "../libs/RedisBillableUsageJournal";
import { RedisUsageStorage } from "../libs/RedisUsageStorage";
import type { MeterDefinition, UsageRecord } from "../libs/types";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
const zaddDeniedUser = "metering-zadd-denied";
const zaddDeniedPassword = "metering-zadd-denied-password";

function createRedisClient(
  connection: RedisTestConnection,
  throwAfterNextEval = false,
): RedisClient {
  let shouldThrowAfterEval = throwAfterNextEval;

  return {
    scriptKeyAccess: "multi-key",
    eval: async <TResult extends unknown[]>(
      script: string,
      keys: string[],
      args: Array<string | number>,
    ): Promise<TResult> => {
      const result = await connection.client.eval(
        script,
        keys.length,
        ...keys,
        ...args.map(String),
      );

      if (shouldThrowAfterEval) {
        shouldThrowAfterEval = false;
        throw new Error("Injected response loss after Redis committed the script");
      }

      return (Array.isArray(result) ? result : [result]) as TResult;
    },
    set: async (key, value, _mode, _expireMode, expire) =>
      connection.client.set(key, value, "EX", expire, "NX"),
    zadd: async (key, score, member) => connection.client.zadd(key, score, member),
    zrangebyscore: async (key, min, max, withScores?) =>
      withScores === "WITHSCORES"
        ? connection.client.zrangebyscore(key, min, max, "WITHSCORES")
        : connection.client.zrangebyscore(key, min, max),
  };
}

function createUsageRecord(idempotencyKey: string): UsageRecord {
  return {
    id: `usage-${idempotencyKey}`,
    tenantId: "tenant-atomic-record",
    meterId: "api_calls",
    value: 5,
    timestamp: new Date("2024-01-15T10:30:00.000Z"),
    idempotencyKey,
  };
}

function createMeterRegistry(meters: MeterDefinition[]): MeterRegistry {
  return {
    getOrThrow: async (tenantId: string, meterId: string) => {
      const meter = meters.find(
        (candidate) => candidate.tenantId === tenantId && candidate.meterId === meterId,
      );
      if (!meter) {
        throw new Error(`Missing test meter ${tenantId}/${meterId}`);
      }
      return meter;
    },
  } as unknown as MeterRegistry;
}

function createMeter(meterId: string, quota?: number): MeterDefinition {
  const now = new Date();
  return {
    id: `meter-${meterId}`,
    tenantId: "tenant-1",
    meterId,
    type: "COUNT",
    quota,
    allowOverQuota: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe.skipIf(!realResourcesEnabled)("Redis metering composition", () => {
  let connection: RedisTestConnection | undefined;
  let dispose: (() => Promise<void> | void) | undefined;

  beforeAll(async () => {
    const resource = redisResource({ id: "metering-redis" });
    const started = await resource.start({
      register: () => undefined,
      testId: "idempotency-namespaces",
      workerId: "metering-core",
    });
    const client = started.connection.client.duplicate({ keyPrefix: "" });
    await client.connect();
    connection = {
      ...started.connection,
      client,
      keyPrefix: "",
    };
    dispose = async () => {
      try {
        await client.quit();
      } finally {
        await started.dispose();
      }
    };
  }, 180_000);

  beforeEach(async () => {
    await connection?.client.flushdb();
  });

  afterEach(async () => {
    await connection?.client.call("ACL", "DELUSER", zaddDeniedUser);
  });

  afterAll(async () => {
    await dispose?.();
  }, 180_000);

  function createService(): MeteringService {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    return new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([createMeter("non-quota"), createMeter("quota", 10)]),
      usageStorage: new RedisUsageStorage(redis),
    });
  }

  async function expectSeparateIdempotencyKeys(
    meterId: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const keys = (await connection.client.keys("*")).filter((key) => key.includes("idem2:")).sort();
    expect(keys).toEqual(
      [
        `${connection.keyPrefix}idem2:delivery:tenant-1:${meterId}:${idempotencyKey}`,
        `${connection.keyPrefix}idem2:lifecycle:tenant-1:${meterId}:${idempotencyKey}`,
        `${connection.keyPrefix}idem2:record:tenant-1:${meterId}:${idempotencyKey}`,
      ].sort(),
    );
  }

  it("acquires a short simple lease and retains only explicit completion for 24 hours", async () => {
    if (!connection) {
      throw new TestResourceLifecycleProblem(
        "metering-redis",
        "startup",
        "Redis test resource did not start",
        [],
      );
    }

    const manager = new IdempotencyManager(createRedisClient(connection));
    const key = "idem2:lifecycle:tenant-1:api_calls:simple-completion";
    const claim = await manager.checkAndMark("tenant-1", "api_calls", "simple-completion");
    expect(claim).toEqual(expect.any(String));
    assert.isNotNull(claim, "Expected a new simple processing claim");

    expect(await connection.client.get(key)).toBe(`IN_PROGRESS:${claim}`);
    const processingTtl = await connection.client.ttl(key);
    expect(processingTtl).toBeGreaterThan(0);
    expect(processingTtl).toBeLessThanOrEqual(30);
    await expect(
      manager.checkAndMark("tenant-1", "api_calls", "simple-completion"),
    ).resolves.toBeNull();

    await manager.completeProcessing("tenant-1", "api_calls", "simple-completion", claim);
    expect(await connection.client.get(key)).toBe("COMPLETED");
    const completedTtl = await connection.client.ttl(key);
    expect(completedTtl).toBeGreaterThanOrEqual(86399);
    expect(completedTtl).toBeLessThanOrEqual(86400);
    await manager.abortProcessing("tenant-1", "api_calls", "simple-completion", claim);
    expect(await connection.client.get(key)).toBe("COMPLETED");
    await expect(
      manager.checkAndMarkOrThrow("tenant-1", "api_calls", "simple-completion"),
    ).rejects.toThrow(DuplicateRecordProblem);
  });

  it("reclaims an expired simple lease across managers and fences the crashed owner", async () => {
    if (!connection) {
      throw new TestResourceLifecycleProblem(
        "metering-redis",
        "startup",
        "Redis test resource did not start",
        [],
      );
    }

    const redis = createRedisClient(connection);
    const crashedManager = new IdempotencyManager(redis, 86400, 1000);
    const replacementManager = new IdempotencyManager(redis);
    const key = "idem2:lifecycle:tenant-1:api_calls:simple-crash";
    const staleClaim = await crashedManager.checkAndMarkOrThrow(
      "tenant-1",
      "api_calls",
      "simple-crash",
    );
    expect(staleClaim).toEqual(expect.any(String));
    expect(await connection.client.get(key)).toBe(`IN_PROGRESS:${staleClaim}`);
    const client = connection.client;
    await expect.poll(() => client.exists(key), { interval: 50, timeout: 3000 }).toBe(0);

    const currentClaim = await replacementManager.checkAndMarkOrThrow(
      "tenant-1",
      "api_calls",
      "simple-crash",
    );
    expect(currentClaim).not.toBe(staleClaim);
    await crashedManager.completeProcessing("tenant-1", "api_calls", "simple-crash", staleClaim);
    expect(await client.get(key)).toBe(`IN_PROGRESS:${currentClaim}`);
    await crashedManager.abortProcessing("tenant-1", "api_calls", "simple-crash", staleClaim);
    expect(await client.get(key)).toBe(`IN_PROGRESS:${currentClaim}`);
    await expect(
      crashedManager.checkAndMarkOrThrow("tenant-1", "api_calls", "simple-crash"),
    ).rejects.toThrow(DuplicateRecordProblem);

    await replacementManager.completeProcessing(
      "tenant-1",
      "api_calls",
      "simple-crash",
      currentClaim,
    );
    expect(await client.get(key)).toBe("COMPLETED");
    expect(await client.ttl(key)).toBeGreaterThanOrEqual(86399);
    await expect(
      crashedManager.checkAndMark("tenant-1", "api_calls", "simple-crash"),
    ).resolves.toBeNull();
  });

  it("persists non-quota usage once when manager and storage share Redis", async () => {
    const service = createService();
    const input = {
      tenantId: "tenant-1",
      meterId: "non-quota",
      value: 1,
      idempotencyKey: "request-1",
    };

    await expect(service.record(input)).resolves.toMatchObject(input);
    await expectSeparateIdempotencyKeys(input.meterId, input.idempotencyKey);
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(1);
  });

  it("persists quota-checked usage once when manager and storage share Redis", async () => {
    const service = createService();
    const input = {
      tenantId: "tenant-1",
      meterId: "quota",
      value: 4,
      idempotencyKey: "request-1",
    };

    await expect(service.record(input)).resolves.toMatchObject(input);
    await expectSeparateIdempotencyKeys(input.meterId, input.idempotencyKey);
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(4);
  });

  it("leaves no dedupe marker after ZADD fails and persists exactly once on retry", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const record = createUsageRecord("zadd-failure");
    const usageKey = "usage2:tenant-atomic-record:api_calls:2024-01";
    const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:zadd-failure";
    await connection.client.call(
      "ACL",
      "SETUSER",
      zaddDeniedUser,
      "on",
      `>${zaddDeniedPassword}`,
      "~*",
      "+@all",
      "-zadd",
    );
    const restrictedClient = connection.client.duplicate({
      keyPrefix: connection.keyPrefix,
      username: zaddDeniedUser,
      password: zaddDeniedPassword,
    });
    await restrictedClient.connect();

    try {
      const restrictedStorage = new RedisUsageStorage(
        createRedisClient({ ...connection, client: restrictedClient }),
      );
      const failedRecord = restrictedStorage.record(record);
      await expect(failedRecord).rejects.toThrow();
      await expect(failedRecord).rejects.toMatchObject({
        code: "metering/redis-error",
        extensions: { operation: "EVAL" },
      });
    } finally {
      await restrictedClient.quit();
    }

    expect(await connection.client.zcard(usageKey)).toBe(0);
    expect(await connection.client.exists(dedupeKey)).toBe(0);

    const storage = new RedisUsageStorage(createRedisClient(connection));
    await storage.record(record);
    await storage.record(record);

    expect(await connection.client.zcard(usageKey)).toBe(1);
    expect(await connection.client.exists(dedupeKey)).toBe(1);
  });

  it("converges an ambiguous committed response to one record on retry", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const record = createUsageRecord("ambiguous-response");
    const usageKey = "usage2:tenant-atomic-record:api_calls:2024-01";
    const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:ambiguous-response";
    const storage = new RedisUsageStorage(createRedisClient(connection, true));

    const ambiguousRecord = storage.record(record);
    await expect(ambiguousRecord).rejects.toThrow();
    await expect(ambiguousRecord).rejects.toMatchObject({
      code: "metering/redis-error",
      extensions: { operation: "EVAL" },
    });
    expect(await connection.client.zcard(usageKey)).toBe(1);
    expect(await connection.client.exists(dedupeKey)).toBe(1);

    await storage.record(record);

    expect(await connection.client.zcard(usageKey)).toBe(1);
    expect(await connection.client.exists(dedupeKey)).toBe(1);
  });

  it.each(["0.1", "1.9", "9007199254740992"])(
    "rejects malformed legacy quota member %s without committing usage or dedupe",
    async (legacyValue) => {
      if (!connection) {
        throw new Error("Redis test resource did not start");
      }

      const usageKey = "usage2:tenant-atomic-record:api_calls:2024-01";
      const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:legacy-member";
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const usageRecord = createUsageRecord("legacy-member");
      await connection.client.zadd(
        usageKey,
        usageRecord.timestamp.getTime(),
        `legacy:${legacyValue}`,
      );

      const quotaCheck = storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 100,
        allowOverQuota: false,
        usageRecord,
      });

      await expect(quotaCheck).rejects.toThrow(RedisProblem);
      await expect(quotaCheck).rejects.toMatchObject({
        code: "metering/redis-error",
        extensions: { operation: "EVAL" },
      });
      expect(await connection.client.zcard(usageKey)).toBe(1);
      expect(await connection.client.exists(dedupeKey)).toBe(0);
    },
  );

  it("computes an exact quota total across valid integer members", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const usageKey = "usage2:tenant-atomic-record:api_calls:2024-01";
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usageRecord = createUsageRecord("integer-total");
    await connection.client.zadd(usageKey, usageRecord.timestamp.getTime() - 2, "legacy-1:3");
    await connection.client.zadd(usageKey, usageRecord.timestamp.getTime() - 1, "legacy-2:7");

    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 100,
        allowOverQuota: false,
        usageRecord,
      }),
    ).resolves.toEqual({ exceeded: false, newUsage: 15 });
    expect(await connection.client.zcard(usageKey)).toBe(3);
  });

  it("replays the maximum safe-integer quota result exactly", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usageRecord = { ...createUsageRecord("max-safe-replay"), value: Number.MAX_SAFE_INTEGER };
    const options = {
      tenantId: usageRecord.tenantId,
      meterId: usageRecord.meterId,
      value: usageRecord.value,
      quota: Number.MAX_SAFE_INTEGER,
      allowOverQuota: false,
      usageRecord,
    };

    await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual({
      exceeded: false,
      newUsage: Number.MAX_SAFE_INTEGER,
    });
    const replayStorage = new RedisUsageStorage(createRedisClient(connection));
    await expect(replayStorage.checkAndRecordWithinQuota(options)).resolves.toEqual({
      exceeded: false,
      newUsage: Number.MAX_SAFE_INTEGER,
    });
  });

  it.each([
    "quota:2:5",
    "quota:0:bad",
    "quota:0:5.0",
    "quota:0:5e0",
    "quota:0:0x10",
    "quota:0: 5",
    "quota:0:0",
    "quota:0:9007199254740991.1",
    "unexpected",
  ])("rejects malformed stored quota result %s", async (storedResult) => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const usageRecord = createUsageRecord("invalid-stored-result");
    const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:invalid-stored-result";
    await connection.client.set(dedupeKey, storedResult);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const request = storage.checkAndRecordWithinQuota({
      tenantId: usageRecord.tenantId,
      meterId: usageRecord.meterId,
      value: usageRecord.value,
      quota: 100,
      allowOverQuota: false,
      usageRecord,
    });

    await expect(request).rejects.toThrow();
    await expect(request).rejects.toMatchObject({
      code: "metering/redis-error",
      extensions: { operation: "EVAL" },
    });
  });

  it("atomically fences concurrent billable delivery claims and replays an expired lease", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }
    const journal = new RedisBillableUsageJournal(createRedisClient(connection));
    const event: BillableUsageEvent = {
      eventId: "billable-event-1",
      tenantId: "tenant-1",
      meterId: "ai.tokens",
      aggregation: "SUM",
      unit: "token",
      value: 100_000_000_000_001,
      dimensions: { model: "gpt-5" },
    };
    await journal.append(event);
    await journal.markDeliverable(event.eventId);

    const competing = await Promise.all([
      journal.claimNext({ ownerId: "worker-1", leaseDurationMs: 100 }),
      journal.claimNext({ ownerId: "worker-2", leaseDurationMs: 100 }),
    ]);
    const first = competing.find((claim) => claim !== null);
    expect(first).toBeDefined();
    expect(competing.filter((claim) => claim !== null)).toHaveLength(1);

    let second: BillableUsageClaim | null = null;
    for (let attempt = 0; attempt < 50 && second === null; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      second = await journal.claimNext({ ownerId: "worker-3", leaseDurationMs: 1_000 });
    }
    if (!second) {
      throw new Error("Expired billable usage lease was not reclaimed within 1 second");
    }
    expect(second.fencingToken).toBeGreaterThan(first?.fencingToken ?? 0);
    await expect(journal.markAccepted(first as BillableUsageClaim)).rejects.toMatchObject({
      code: "metering/transition-conflict",
    });
    await journal.markAccepted(second);

    await expect(journal.get(event.eventId)).resolves.toMatchObject({
      state: "accepted",
      event: { value: 100_000_000_000_001 },
    });
    await expect(journal.getDiagnostics()).resolves.toMatchObject({ backlogCount: 0 });
  });
});
