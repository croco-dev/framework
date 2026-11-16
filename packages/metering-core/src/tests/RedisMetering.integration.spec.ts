import {
  redisResource,
  TestResourceLifecycleProblem,
  type RedisTestConnection,
} from "@croco/testing-resources";
import type { EventBus } from "@croco/events-core";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  assert,
  vi,
} from "vitest";
import { QuotaExceededEvent } from "../libs/events/QuotaExceededEvent";
import { UsageRecordedEvent } from "../libs/events/UsageRecordedEvent";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import type { BillableUsageClaim, BillableUsageEvent } from "../libs/BillableUsageJournal";
import type { MeterRepository } from "../libs/MeterRepository";
import { UsageAggregator } from "../libs/UsageAggregator";
import { MeteringService } from "../libs/MeteringService";
import { defineMeter, dimension } from "../libs/MeterRef";
import type { MeterRegistry } from "../libs/MeterRegistry";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import { QuotaExceededProblem } from "../libs/problems/QuotaExceededProblem";
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
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

  function createFlushingService() {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const usageStorage = new RedisUsageStorage(redis);
    const saved = new Map<string, UsageRecord>();
    const meterRepository: MeterRepository = {
      replayContract: "idempotent",
      findByMeterIdAndTenant: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
      findByTenant: vi.fn(),
      saveUsageRecords: vi.fn(async (records: UsageRecord[]) => {
        for (const record of records) {
          saved.set(
            JSON.stringify([record.tenantId, record.meterId, record.idempotencyKey]),
            record,
          );
        }
      }),
    };

    return {
      service: new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry: createMeterRegistry([createMeter("quota", 10)]),
        usageStorage,
      }),
      aggregator: new UsageAggregator({ usageStorage, meterRepository }),
      saved,
    };
  }

  it("keeps rejecting over-quota usage after the current billing cycle is flushed", async () => {
    const { service, aggregator } = createFlushingService();
    const usage = { tenantId: "tenant-1", meterId: "quota" };

    await service.record({ ...usage, value: 10, idempotencyKey: "request-1" });
    await expect(
      service.record({ ...usage, value: 1, idempotencyKey: "request-2" }),
    ).rejects.toBeInstanceOf(QuotaExceededProblem);

    await expect(aggregator.flushUsageToDB("tenant-1", "quota")).resolves.toEqual({
      recordsFlushed: 1,
    });

    await expect(
      service.record({ ...usage, value: 10, idempotencyKey: "request-3" }),
    ).rejects.toBeInstanceOf(QuotaExceededProblem);
  });

  it("reports current billing cycle usage after repeated idempotent flushes", async () => {
    const { service, aggregator, saved } = createFlushingService();
    const usage = { tenantId: "tenant-1", meterId: "quota" };

    await service.record({ ...usage, value: 7, idempotencyKey: "request-1" });
    await expect(service.getUsage({ ...usage, period: "billing_cycle" })).resolves.toBe(7);
    await aggregator.flushUsageToDB("tenant-1", "quota");
    await expect(service.getUsage({ ...usage, period: "billing_cycle" })).resolves.toBe(7);
    await expect(aggregator.flushUsageToDB("tenant-1", "quota")).resolves.toEqual({
      recordsFlushed: 1,
    });
    await expect(service.getUsage({ ...usage, period: "billing_cycle" })).resolves.toBe(7);
    expect(saved.size).toBe(1);
  });

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

  it.each([undefined, 10])(
    "preserves the stored timestamp after a staging failure with quota %s",
    async (quota) => {
      if (!connection) {
        throw new Error("Redis test resource did not start");
      }

      const redis = createRedisClient(connection);
      const meter = createMeter("persistence-replay", quota);
      const meterRegistry = createMeterRegistry([meter]);
      const usageStorage = new RedisUsageStorage(redis);
      const manager = new IdempotencyManager(redis);
      vi.spyOn(manager, "markMeteringEventsPublishing").mockRejectedValueOnce(
        new Error("Injected staging failure before Redis commit"),
      );
      const service = new MeteringService({
        idempotencyManager: manager,
        meterRegistry,
        usageStorage,
      });
      const input = {
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        value: 10,
        idempotencyKey: "uncertain-persistence",
      };

      await expect(service.record(input)).rejects.toThrow("Injected staging failure");
      await expect(
        service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
      ).resolves.toBe("persistence-uncertain");

      const restartedStorage = new RedisUsageStorage(redis);
      const restarted = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry,
        usageStorage: restartedStorage,
      });
      const query = {
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle" as const,
      };
      const storedBeforeRetry = await restartedStorage.fetchUsageRecords(query);
      expect(storedBeforeRetry).toHaveLength(1);
      const [stored] = storedBeforeRetry;
      assert.isDefined(stored);
      expect(stored).toMatchObject(input);
      const period = stored.timestamp.toISOString().slice(0, 7);
      const usageKey = `usage2:${input.tenantId}:${input.meterId}:${period}`;
      const members = await connection.client.zrange(usageKey, 0, -1, "WITHSCORES");
      expect(members).toHaveLength(2);
      expect(members[1]).toBe(String(stored.timestamp.getTime()));
      // Distinguish a timestamp generated by the retry even when Redis is very fast.
      await expect.poll(() => Date.now()).toBeGreaterThan(stored.timestamp.getTime());

      await expect(restarted.record({ ...input, value: 1 })).rejects.toThrow(
        DuplicateRecordProblem,
      );
      await expect(restarted.record(input)).resolves.toEqual(stored);
      await expect(restartedStorage.fetchUsageRecords(query)).resolves.toEqual([stored]);
      await expect(connection.client.zrange(usageKey, 0, -1, "WITHSCORES")).resolves.toEqual(
        members,
      );
      await expect(restarted.getUsage(query)).resolves.toBe(input.value);
    },
  );

  it.each(["present", "expired"] as const)(
    "replays quota usage in its original UTC billing month when its write marker is %s",
    async (marker) => {
      if (!connection) {
        throw new Error("Redis test resource did not start");
      }

      const redis = createRedisClient(connection);
      const manager = new IdempotencyManager(redis);
      const usageStorage = new RedisUsageStorage(redis);
      const meter = createMeter("quota", 3);
      const { tenantId, meterId } = meter;
      const input = { tenantId, meterId, idempotencyKey: "month-boundary", value: 3 };
      const claim = await manager.claimMeteringProcessingOrThrow(
        tenantId,
        meterId,
        input.idempotencyKey,
      );
      const timestamp = "2000-01-31T23:59:59.000Z";
      const record = { ...input, id: claim.operationId, timestamp };
      await manager.markMeteringPersistenceStarted(
        tenantId,
        meterId,
        input.idempotencyKey,
        claim.token,
        record,
      );
      const stored = { ...record, timestamp: new Date(timestamp) };
      await usageStorage.checkAndRecordWithinQuota({
        tenantId,
        meterId,
        value: input.value,
        quota: 3,
        allowOverQuota: false,
        usageRecord: stored,
      });
      await manager.releaseMeteringProcessing(tenantId, meterId, input.idempotencyKey, claim.token);
      if (marker === "expired") {
        await connection.client.del("idem2:record:tenant-1:quota:month-boundary");
      }
      const usageKeyPrefix = `usage2:${tenantId}:${meterId}`;
      const januaryKey = `${usageKeyPrefix}:2000-01`;
      const members = await connection.client.zrange(januaryKey, 0, -1, "WITHSCORES");
      expect(members).toHaveLength(2);
      expect(members[1]).toBe(String(stored.timestamp.getTime()));

      const restartedStorage = new RedisUsageStorage(redis);
      const service = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry: createMeterRegistry([meter]),
        usageStorage: restartedStorage,
      });
      await expect(service.record(input)).resolves.toEqual(stored);
      await expect(connection.client.zrange(januaryKey, 0, -1, "WITHSCORES")).resolves.toEqual(
        members,
      );
      await expect(connection.client.keys(`${usageKeyPrefix}:*`)).resolves.toEqual([januaryKey]);
      const query = { tenantId, meterId, period: "billing_cycle" as const };
      await expect(
        restartedStorage.fetchUsageRecords({
          ...query,
          startDate: new Date("2000-01-01T00:00:00.000Z"),
          endDate: new Date("2000-02-28T23:59:59.999Z"),
        }),
      ).resolves.toEqual([stored]);
      await expect(service.getUsage(query)).resolves.toBe(0);
    },
  );

  it("keeps a prior-month staged write uncertain when it has no durable usage evidence", async () => {
    assert.isDefined(connection);
    const redis = createRedisClient(connection);
    const manager = new IdempotencyManager(redis);
    const journal = new RedisBillableUsageJournal(redis);
    const meter = createMeter("closed-unconfirmed", 3);
    meter.billing = "required";
    const { tenantId, meterId } = meter;
    const input = { tenantId, meterId, idempotencyKey: "old-unconfirmed", value: 3 };
    const claim = await manager.claimMeteringProcessingOrThrow(
      tenantId,
      meterId,
      input.idempotencyKey,
    );
    await manager.markMeteringPersistenceStarted(
      tenantId,
      meterId,
      input.idempotencyKey,
      claim.token,
      { ...input, id: claim.operationId, timestamp: "2000-01-31T23:59:59.000Z" },
    );
    await manager.releaseMeteringProcessing(tenantId, meterId, input.idempotencyKey, claim.token);

    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: {
        ...createMeterRegistry([meter]),
        billableUsageJournal: journal,
      } as unknown as MeterRegistry,
      usageStorage: new RedisUsageStorage(redis),
    });
    await expect(service.record(input)).rejects.toMatchObject({
      code: "metering/transition-conflict",
      extensions: { reason: "USAGE_RECORD_UNAVAILABLE" },
    });
    await expect(service.getRecordStatus(tenantId, meterId, input.idempotencyKey)).resolves.toBe(
      "persistence-uncertain",
    );
    await expect(connection.client.keys(`usage2:${tenantId}:${meterId}:*`)).resolves.toEqual([]);
    await expect(journal.get(input.idempotencyKey)).resolves.toBeNull();
  });

  it.each(["quota response lost", "staging failed"] as const)(
    "rechecks current UTC quota after a known rejection with %s",
    async (failure) => {
      if (!connection) {
        throw new Error("Redis test resource did not start");
      }

      const redis = createRedisClient(connection);
      const manager = new IdempotencyManager(redis);
      const usageStorage = new RedisUsageStorage(redis);
      const meter = createMeter("quota", 3);
      const { tenantId, meterId } = meter;
      const timestamp = "2000-01-31T23:59:59.000Z";
      await usageStorage.record({
        id: "prior-usage",
        tenantId,
        meterId,
        idempotencyKey: "prior-usage",
        value: 3,
        timestamp: new Date(timestamp),
      });
      const input = { tenantId, meterId, idempotencyKey: "rejected-in-previous-month", value: 1 };
      const claim = await manager.claimMeteringProcessingOrThrow(
        tenantId,
        meterId,
        input.idempotencyKey,
      );
      const record = { ...input, id: claim.operationId, timestamp };
      await manager.markMeteringPersistenceStarted(
        tenantId,
        meterId,
        input.idempotencyKey,
        claim.token,
        record,
      );
      // Seed the state left by a January quota decision before the present-day service resumes it.
      const denial = await usageStorage.checkAndRecordWithinQuota({
        tenantId,
        meterId,
        value: input.value,
        quota: 3,
        allowOverQuota: false,
        resuming: true,
        writeGeneration: 1,
        usageRecord: { ...record, timestamp: new Date(timestamp) },
      });
      expect(denial).toEqual({ newUsage: 4, exceeded: true, recorded: false });
      if (failure === "quota response lost") {
        await manager.releaseMeteringProcessing(
          tenantId,
          meterId,
          input.idempotencyKey,
          claim.token,
        );
      } else {
        await manager.releaseMeteringQuotaRejection(
          tenantId,
          meterId,
          input.idempotencyKey,
          claim.token,
          {
            usageRecord: record,
            quota: { newUsage: denial.newUsage, exceeded: true, allowOverQuota: false, quota: 3 },
          },
        );
      }
      const service = new MeteringService({
        idempotencyManager: manager,
        meterRegistry: createMeterRegistry([meter]),
        usageStorage,
      });
      await expect(service.getRecordStatus(tenantId, meterId, input.idempotencyKey)).resolves.toBe(
        failure === "quota response lost" ? "persistence-uncertain" : "retryable",
      );
      await expect(service.record(input)).resolves.toMatchObject({
        ...input,
        id: claim.operationId,
      });
      await expect(service.getUsage({ tenantId, meterId, period: "billing_cycle" })).resolves.toBe(
        1,
      );
    },
  );

  it("keeps one timestamp if a quota retry loses its lease before writing", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const tenantId = "tenant-1";
    const meter = createMeter("quota-takeover", 3);
    const { meterId } = meter;
    const input = { tenantId, meterId, idempotencyKey: "retry", value: 5 };
    const meterRegistry = createMeterRegistry([meter]);
    const storage = new RedisUsageStorage(redis);
    const service = new MeteringService({
      usageStorage: storage,
      meterRegistry,
      idempotencyManager: new IdempotencyManager(redis),
    });
    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    meter.quota = 10;

    const oldWriterPaused = deferred();
    const releaseOldWriter = deferred();
    const oldWriterStore = new RedisUsageStorage(redis);
    const writeOld = oldWriterStore.checkAndRecordWithinQuota.bind(oldWriterStore);
    let stagedTimestamp = 0;
    vi.spyOn(oldWriterStore, "checkAndRecordWithinQuota").mockImplementationOnce(
      async (options) => {
        stagedTimestamp = options.usageRecord.timestamp.getTime();
        oldWriterPaused.resolve();
        await releaseOldWriter.promise;
        return writeOld(options);
      },
    );
    const oldWriter = new MeteringService({
      usageStorage: oldWriterStore,
      meterRegistry,
      idempotencyManager: new IdempotencyManager(redis),
    });
    const loser = oldWriter.record(input);
    const lostLease = expect(loser).rejects.toMatchObject({ code: "metering/transition-conflict" });

    const newWriterStore = new RedisUsageStorage(redis);
    const newWriterPaused = deferred();
    const releaseNewWriter = deferred();
    const writeNew = newWriterStore.checkAndRecordWithinQuota.bind(newWriterStore);
    vi.spyOn(newWriterStore, "checkAndRecordWithinQuota").mockImplementationOnce(
      async (options) => {
        newWriterPaused.resolve();
        await releaseNewWriter.promise;
        return writeNew(options);
      },
    );
    try {
      await oldWriterPaused.promise;
      await expect.poll(() => Date.now()).toBeGreaterThan(stagedTimestamp);
      await connection.client.eval(
        "local s = cjson.decode(redis.call('GET', KEYS[1])); s.leaseExpiresAt = 0; return redis.call('SET', KEYS[1], cjson.encode(s), 'KEEPTTL')",
        1,
        "idem2:delivery:tenant-1:quota-takeover:retry",
      );
      const newWriter = new MeteringService({
        usageStorage: newWriterStore,
        meterRegistry,
        idempotencyManager: new IdempotencyManager(redis),
      });
      const winner = newWriter.record(input);
      await newWriterPaused.promise;
      releaseOldWriter.resolve();
      await lostLease;
      releaseNewWriter.resolve();
      const record = await winner;
      expect(record.timestamp.getTime()).toBe(stagedTimestamp);
      await expect(
        storage.fetchUsageRecords({ tenantId, meterId, period: "billing_cycle" }),
      ).resolves.toEqual([record]);
    } finally {
      releaseOldWriter.resolve();
      releaseNewWriter.resolve();
    }
  });

  it.each(["reservation", "legacy quota result"] as const)(
    "requires actual write evidence for a %s",
    async (legacy) => {
      assert.isDefined(connection);
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const input = createUsageRecord("reserved");
      if (legacy === "reservation") {
        await expect(
          storage.isIdempotent(input.tenantId, input.meterId, input.idempotencyKey, 60),
        ).resolves.toBe(true);
      } else {
        await connection.client.set(
          "idem2:record:tenant-atomic-record:api_calls:reserved",
          "quota:1:5",
        );
      }
      await expect(storage.readWriteReceipt(input)).resolves.toBeUndefined();
      await expect(storage.record(input, 1)).rejects.toThrow(
        "Legacy usage marker does not prove a recorded write",
      );

      const committed = { ...input, idempotencyKey: "committed" };
      await storage.record(committed, 1);
      await expect(storage.readWriteReceipt(committed)).resolves.toEqual({
        outcome: "recorded",
        operationId: committed.id,
      });
      await expect(
        storage.fetchUsageRecords({
          tenantId: input.tenantId,
          meterId: input.meterId,
          period: "billing_cycle",
          startDate: input.timestamp,
          endDate: input.timestamp,
        }),
      ).resolves.toEqual([committed]);
    },
  );

  it("does not expose an untracked reservation as quota write proof", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usageRecord = createUsageRecord("quota-reservation");
    const { tenantId, meterId, value, idempotencyKey } = usageRecord;
    await expect(storage.isIdempotent(tenantId, meterId, idempotencyKey, 60)).resolves.toBe(true);
    const options = {
      tenantId,
      meterId,
      value,
      quota: value,
      allowOverQuota: false,
      usageRecord,
      resuming: true as const,
    };
    const legacyResult = { exceeded: false, newUsage: 0 };
    await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual(legacyResult);
    await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual(legacyResult);
    await expect(storage.readWriteReceipt(usageRecord)).resolves.toBeUndefined();
  });

  it("rechecks untracked quota after an ambiguous reservation expires", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const prior = createUsageRecord("already-used");
    const usageRecord = createUsageRecord("temporary-quota-reservation");
    const { tenantId, meterId, value, idempotencyKey } = usageRecord;
    await storage.record(prior);
    await expect(storage.isIdempotent(tenantId, meterId, idempotencyKey, 60)).resolves.toBe(true);
    const options = {
      tenantId,
      meterId,
      value,
      quota: value - 1,
      allowOverQuota: false,
      usageRecord,
    };
    await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual({
      exceeded: true,
      newUsage: prior.value,
    });
    await connection.client.del(`idem2:record:${tenantId}:${meterId}:${idempotencyKey}`);
    const raisedQuota = prior.value + value;
    await expect(
      storage.checkAndRecordWithinQuota({ ...options, quota: raisedQuota }),
    ).resolves.toEqual({
      exceeded: false,
      newUsage: raisedQuota,
    });
    await expect(connection.client.zcard(`usage2:${tenantId}:${meterId}:2024-01`)).resolves.toBe(2);
  });

  it.each(["non-quota", "quota"] as const)(
    "refreshes cached untracked quota after a %s tracked write",
    async (write) => {
      assert.isDefined(connection);
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const usageRecord = createUsageRecord("tracked-after-reservation");
      const { tenantId, meterId, value, idempotencyKey } = usageRecord;
      const options = {
        tenantId,
        meterId,
        value,
        quota: value,
        allowOverQuota: false,
        usageRecord,
      };
      await expect(storage.isIdempotent(tenantId, meterId, idempotencyKey, 60)).resolves.toBe(true);
      await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual({
        exceeded: false,
        newUsage: 0,
      });
      await connection.client.del(`idem2:record:${tenantId}:${meterId}:${idempotencyKey}`);
      if (write === "non-quota") {
        await storage.record(usageRecord, 1);
      } else {
        await expect(
          storage.checkAndRecordWithinQuota({ ...options, writeGeneration: 1, resuming: true }),
        ).resolves.toEqual({ exceeded: false, newUsage: value, recorded: true });
      }
      await expect(storage.checkAndRecordWithinQuota(options)).resolves.toEqual({
        exceeded: false,
        newUsage: value,
      });
    },
  );

  it.each(["quota:0:0:5", "quota:1:0:5:id.%GG:1", "quota:1:0:5:id.%ED%A0%80:1"])(
    "rejects malformed Redis marker %s before writing",
    async (marker) => {
      assert.isDefined(connection);
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const input = createUsageRecord("corrupt-marker");
      await connection.client.set(
        "idem2:record:tenant-atomic-record:api_calls:corrupt-marker",
        marker,
      );
      await expect(storage.record(input, 1)).rejects.toThrow("Invalid stored usage receipt");
      await expect(
        storage.checkAndRecordWithinQuota({
          tenantId: input.tenantId,
          meterId: input.meterId,
          value: input.value,
          usageRecord: input,
          quota: input.value,
          allowOverQuota: false,
          writeGeneration: 1,
        }),
      ).rejects.toThrow("Invalid stored quota result");
      await expect(
        storage.fetchUsageRecords({
          tenantId: input.tenantId,
          meterId: input.meterId,
          period: "billing_cycle",
          startDate: input.timestamp,
          endDate: input.timestamp,
        }),
      ).resolves.toEqual([]);
    },
  );

  it.each([undefined, 3])(
    "will not reuse a previous operation's durable write after its lifecycle expires (quota %s)",
    async (quota) => {
      assert.isDefined(connection);
      const redis = createRedisClient(connection);
      const meter = createMeter("operation-identity", quota);
      meter.allowOverQuota = true;
      const meterRegistry = createMeterRegistry([meter]);
      const publish = vi.fn();
      const input = {
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        value: 5,
        idempotencyKey: "reused",
      };
      const service = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry,
        usageStorage: new RedisUsageStorage(redis),
      });
      const stored = await service.record(input);
      await connection.client.del(
        "idem2:delivery:tenant-1:operation-identity:reused",
        "idem2:lifecycle:tenant-1:operation-identity:reused",
      );
      meter.quota = 3;
      meter.allowOverQuota = false;
      const storage = new RedisUsageStorage(redis);
      const restarted = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry,
        usageStorage: storage,
        eventBus: { publish } as unknown as EventBus,
      });
      await expect(restarted.record({ ...input, value: 6 })).rejects.toThrow(
        "Recorded usage belongs to a different operation",
      );
      await expect(restarted.record({ ...input, value: 6 })).rejects.toThrow(
        DuplicateRecordProblem,
      );
      expect(publish).not.toHaveBeenCalled();
      await expect(
        storage.fetchUsageRecords({
          tenantId: input.tenantId,
          meterId: input.meterId,
          period: "billing_cycle",
        }),
      ).resolves.toEqual([stored]);
    },
  );

  it.each(["", "order:1"])(
    "round-trips a denial for operation %j without admitting invalid generations",
    async (id) => {
      assert.isDefined(connection);
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const usageRecord = { ...createUsageRecord("tracked-denial-codec"), id };
      const input = {
        usageRecord,
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: 1,
        allowOverQuota: false,
      };
      await expect(
        storage.checkAndRecordWithinQuota({ ...input, writeGeneration: 0 }),
      ).rejects.toThrow("Usage write generation must be a positive safe integer");
      await expect(storage.record(usageRecord, 1.5)).rejects.toThrow(
        "Usage write generation must be a positive safe integer",
      );
      await expect(storage.readWriteReceipt(usageRecord)).resolves.toBeUndefined();
      await expect(
        storage.checkAndRecordWithinQuota({ ...input, writeGeneration: 1 }),
      ).resolves.toMatchObject({ exceeded: true });
      await expect(storage.readWriteReceipt(usageRecord)).resolves.toEqual({
        outcome: "rejected",
        operationId: id,
        writeGeneration: 1,
      });
    },
  );

  it("fails a stale quota-write attempt before it can act on another writer's denial", async () => {
    assert.isDefined(connection);
    const usageStorage = new RedisUsageStorage(createRedisClient(connection));
    const usageRecord = createUsageRecord("closed-attempt");
    const input = {
      usageRecord,
      tenantId: usageRecord.tenantId,
      meterId: usageRecord.meterId,
      value: usageRecord.value,
      quota: 1,
      resuming: true as const,
      writeGeneration: 1,
    };
    await expect(
      usageStorage.checkAndRecordWithinQuota({
        ...input,
        allowOverQuota: false,
      }),
    ).resolves.toMatchObject({ exceeded: true, recorded: false });
    await expect(
      usageStorage.checkAndRecordWithinQuota({
        ...input,
        allowOverQuota: true,
      }),
    ).rejects.toThrow("Usage write attempt was already denied by quota");
    await expect(
      usageStorage.checkAndRecordWithinQuota({
        ...input,
        writeGeneration: 2,
        allowOverQuota: true,
      }),
    ).resolves.toMatchObject({ exceeded: true, recorded: true });
  });

  it("completes a recorded overage even after the policy stops allowing overages", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const usageStorage = new RedisUsageStorage(redis);
    const manager = new IdempotencyManager(redis);
    const meter = createMeter("overage-replay", 3);
    meter.allowOverQuota = true;
    const meterRegistry = createMeterRegistry([meter]);
    const input = {
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      value: 5,
      idempotencyKey: "overage",
    };
    vi.spyOn(manager, "markMeteringEventsPublishing").mockRejectedValueOnce(
      new Error("staging unavailable"),
    );
    const service = new MeteringService({
      usageStorage,
      meterRegistry,
      idempotencyManager: manager,
    });
    await expect(service.record(input)).rejects.toThrow("staging unavailable");

    const query = {
      tenantId: input.tenantId,
      meterId: input.meterId,
      period: "billing_cycle" as const,
    };
    const stored = await usageStorage.fetchUsageRecords(query);
    expect(stored).toHaveLength(1);
    meter.allowOverQuota = false;
    const restarted = new MeteringService({
      usageStorage: new RedisUsageStorage(redis),
      meterRegistry,
      idempotencyManager: new IdempotencyManager(redis),
    });
    await expect(restarted.record(input)).resolves.toEqual(stored[0]);
    await expect(usageStorage.fetchUsageRecords(query)).resolves.toEqual(stored);
  });

  it("retains the quota outcome committed between the marker lookup and row lookup", async () => {
    assert.isDefined(connection);
    const redis = createRedisClient(connection);
    const manager = new IdempotencyManager(redis);
    const writer = new RedisUsageStorage(redis);
    const storage = new RedisUsageStorage(redis);
    const publish = vi.fn();
    const meter = createMeter("quota-takeover-outcome", 3);
    const { tenantId, meterId } = meter;
    const input = { tenantId, meterId, idempotencyKey: "committed-during-takeover", value: 5 };
    const claim = await manager.claimMeteringProcessingOrThrow(
      tenantId,
      meterId,
      input.idempotencyKey,
    );
    const timestamp = new Date();
    const stored = { ...input, id: claim.operationId, timestamp };
    await manager.markMeteringPersistenceStarted(
      tenantId,
      meterId,
      input.idempotencyKey,
      claim.token,
      { ...stored, timestamp: timestamp.toISOString() },
    );
    await manager.releaseMeteringProcessing(tenantId, meterId, input.idempotencyKey, claim.token);
    const readReceipt = storage.readWriteReceipt.bind(storage);
    vi.spyOn(storage, "readWriteReceipt").mockImplementationOnce(async (identity) => {
      const priorReceipt = await readReceipt(identity);
      expect(priorReceipt).toBeUndefined();
      await expect(
        writer.checkAndRecordWithinQuota({
          tenantId,
          meterId,
          value: input.value,
          quota: 3,
          allowOverQuota: true,
          usageRecord: stored,
          writeGeneration: 1,
          resuming: true,
        }),
      ).resolves.toEqual({ exceeded: true, newUsage: input.value, recorded: true });
      return priorReceipt;
    });
    const restarted = new MeteringService({
      usageStorage: storage,
      meterRegistry: createMeterRegistry([meter]),
      idempotencyManager: new IdempotencyManager(redis),
      eventBus: { publish } as unknown as EventBus,
    });

    await expect(restarted.record(input)).resolves.toEqual(stored);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(1, expect.any(QuotaExceededEvent));
    expect(publish).toHaveBeenNthCalledWith(2, expect.any(UsageRecordedEvent));
  });

  it("uses the admitted metadata if the caller mutates it while the receipt is saved", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const manager = new IdempotencyManager(redis);
    const usageStorage = new RedisUsageStorage(redis);
    const meter = createMeter("metadata-snapshot");
    const bytes = new Uint8Array(new SharedArrayBuffer(1));
    const metadata = { nested: { source: "initial" }, bytes };
    const markStarted = manager.markMeteringPersistenceStarted.bind(manager);
    vi.spyOn(manager, "markMeteringPersistenceStarted").mockImplementationOnce(async (...args) => {
      await markStarted(...args);
      metadata.nested.source = "mutated";
      bytes[0] = 1;
    });
    const service = new MeteringService({
      usageStorage,
      idempotencyManager: manager,
      meterRegistry: createMeterRegistry([meter]),
    });
    const record = await service.record({
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      idempotencyKey: "mutation",
      metadata,
    });
    expect(record.metadata).toEqual({ nested: { source: "initial" }, bytes: { 0: 0 } });
    await expect(
      usageStorage.fetchUsageRecords({
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toEqual([record]);
  });

  it("serializes caller metadata into the same durable payload used for storage and publication", async () => {
    assert.isDefined(connection);
    const service = createService();
    const input = {
      tenantId: "tenant-1",
      meterId: "non-quota",
      idempotencyKey: "dynamic-metadata",
    };
    let serializations = 0;
    const record = await service.record({
      ...input,
      metadata: {
        toJSON: () => ({ note: ++serializations === 1 ? "admitted" : "changed" }),
      },
    });
    expect(record.metadata).toEqual({ note: "admitted" });
    expect(serializations).toBe(1);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    await expect(
      storage.fetchUsageRecords({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toEqual([record]);
  });

  it.each(["WebAssembly.Memory", "Error.cause"])(
    "does not expose shared memory through %s in the usage result",
    async (container) => {
      assert.isDefined(connection);
      const redis = createRedisClient(connection);
      const manager = new IdempotencyManager(redis);
      const meter = createMeter("runtime-metadata");
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
      const sharedView = new Uint8Array(memory.buffer);
      const payload =
        container === "Error.cause" ? new Error("metadata", { cause: sharedView }) : memory;
      const markStarted = manager.markMeteringPersistenceStarted.bind(manager);
      vi.spyOn(manager, "markMeteringPersistenceStarted").mockImplementationOnce(
        async (...args) => {
          await markStarted(...args);
          sharedView[0] = 5;
        },
      );
      const storage = new RedisUsageStorage(redis);
      const service = new MeteringService({
        usageStorage: storage,
        idempotencyManager: manager,
        meterRegistry: createMeterRegistry([meter]),
      });
      const record = await service.record({
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        idempotencyKey: "shared-memory",
        metadata: { payload },
      });
      expect(record.metadata).toStrictEqual({ payload: {} });
    },
  );

  it("keeps detached Buffer metadata in the first result and usage event", async () => {
    assert.isDefined(connection);
    const redis = createRedisClient(connection);
    const meter = createMeter("buffer-metadata");
    const publish = vi.fn();
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([meter]),
      usageStorage: new RedisUsageStorage(redis),
      eventBus: { publish } as unknown as EventBus,
    });
    const buffer = Buffer.from([1, 2]);
    const record = await service.record({
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      idempotencyKey: "binary-metadata",
      metadata: { nested: { buffer } },
    });
    const stored = (record.metadata?.nested as { buffer: Buffer }).buffer;
    expect(Buffer.isBuffer(stored)).toBe(true);
    expect(stored).toEqual(buffer);
    expect(stored).not.toBe(buffer);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { nested: { buffer } } }),
    );
  });

  it("preserves application metadata on replay and permits correcting malformed metadata before storage", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const manager = new IdempotencyManager(redis);
    const publish = vi.fn();
    const service = new MeteringService({
      idempotencyManager: manager,
      meterRegistry: createMeterRegistry([createMeter("metadata")]),
      usageStorage: new RedisUsageStorage(redis),
      eventBus: { publish } as unknown as EventBus,
    });
    const input = { tenantId: "tenant-1", meterId: "metadata", idempotencyKey: "repair-metadata" };
    await expect(service.record({ ...input, metadata: { note: "\ud800" } })).rejects.toMatchObject({
      code: "metering/redis-error",
      extensions: { operation: "SERIALIZE" },
    });
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("missing");

    await expect(
      service.record({ ...input, metadata: { toJSON: () => "scalar" } }),
    ).rejects.toThrow("Usage metadata must serialize to a JSON object");

    class Details {
      z = 1;
      a = 2;
    }
    const metadata = {
      details: new Details(),
      time: new Date("2026-01-01T00:00:00.000Z"),
      empty: undefined,
      bytes: new Uint8Array([1, 2]),
      tags: new Set(["original"]),
    };
    vi.spyOn(manager, "markMeteringEventsPublishing").mockRejectedValueOnce(
      new Error("Injected staging failure before Redis commit"),
    );
    await expect(service.record({ ...input, metadata })).rejects.toThrow(
      "Injected staging failure",
    );
    const record = await service.record({
      ...input,
      metadata: { ...metadata, tags: new Set(["retry"]) },
    });
    const durableMetadata = {
      details: { z: 1, a: 2 },
      time: metadata.time.toISOString(),
      bytes: { 0: 1, 1: 2 },
      tags: {},
    };
    expect(record.metadata).toStrictEqual(durableMetadata);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ metadata: durableMetadata }));
  });

  it("keeps a legacy processing claim without its original usage record uncertain", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const redis = createRedisClient(connection);
    const manager = new IdempotencyManager(redis);
    const usageStorage = new RedisUsageStorage(redis);
    const tenantId = "tenant-1";
    const meterId = "quota";
    const idempotencyKey = "legacy-persistence";
    const claim = await manager.claimMeteringProcessingOrThrow(tenantId, meterId, idempotencyKey);
    await manager.markMeteringPersistenceStarted(tenantId, meterId, idempotencyKey, claim.token);
    await manager.releaseMeteringProcessing(tenantId, meterId, idempotencyKey, claim.token);
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([createMeter(meterId, 10)]),
      usageStorage,
    });

    await expect(
      service.record({ tenantId, meterId, idempotencyKey, value: 3 }),
    ).rejects.toMatchObject({
      code: "metering/transition-conflict",
      extensions: { reason: "USAGE_RECORD_UNAVAILABLE" },
    });
    await expect(service.getRecordStatus(tenantId, meterId, idempotencyKey)).resolves.toBe(
      "persistence-uncertain",
    );
    await expect(service.getUsage({ tenantId, meterId, period: "billing_cycle" })).resolves.toBe(0);
  });

  it.each([undefined, 10])(
    "completes persistence replay after provider acceptance with quota %s",
    async (quota) => {
      if (!connection) {
        throw new Error("Redis test resource did not start");
      }

      const redis = createRedisClient(connection);
      const journal = new RedisBillableUsageJournal(redis);
      const manager = new IdempotencyManager(redis);
      vi.spyOn(manager, "markMeteringEventsPublishing").mockRejectedValueOnce(
        new Error("Injected staging failure before Redis commit"),
      );
      const meter = createMeter("billable-replay", quota);
      meter.billing = "required";
      meter.aggregation = "COUNT";
      meter.unit = "request";
      const publish = vi.fn();
      const meterRegistry = {
        ...createMeterRegistry([meter]),
        billableUsageJournal: journal,
      } as unknown as MeterRegistry;
      const usageStorage = new RedisUsageStorage(redis);
      const service = new MeteringService({
        idempotencyManager: manager,
        meterRegistry,
        usageStorage,
        eventBus: { publish, subscribe: vi.fn() } as unknown as EventBus,
      });
      const input = {
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        value: 5,
        idempotencyKey: "accepted-before-persistence-replay",
      };
      await expect(service.record(input)).rejects.toThrow("Injected staging failure");
      await expect(
        service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
      ).resolves.toBe("persistence-uncertain");
      expect(publish).not.toHaveBeenCalled();

      const claim = await journal.claimNext({ ownerId: "billing-worker", leaseDurationMs: 10_000 });
      assert.isNotNull(claim);
      const accepted = await journal.markAccepted(claim);

      const usageQuery = {
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle" as const,
      };
      const rows = await usageStorage.fetchUsageRecords(usageQuery);
      expect(rows).toHaveLength(1);
      const [stored] = rows;
      assert.isDefined(stored);
      await expect.poll(() => Date.now()).toBeGreaterThan(stored.timestamp.getTime());
      const restarted = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry,
        usageStorage: new RedisUsageStorage(redis),
        eventBus: { publish, subscribe: vi.fn() } as unknown as EventBus,
      });
      await expect(restarted.record(input)).resolves.toEqual(stored);
      await expect(usageStorage.fetchUsageRecords(usageQuery)).resolves.toEqual([stored]);
      await expect(journal.get(input.idempotencyKey)).resolves.toEqual(accepted);
      await expect(
        service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
      ).resolves.toBe("completed");
      await expect(
        service.getUsage({
          tenantId: input.tenantId,
          meterId: input.meterId,
          period: "billing_cycle",
        }),
      ).resolves.toBe(input.value);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(expect.any(UsageRecordedEvent));
      await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
      await expect(
        journal.claimNext({ ownerId: "billing-worker-2", leaseDurationMs: 1_000 }),
      ).resolves.toBeNull();
    },
  );

  it("keeps quota rejection retryable while overage remains disallowed", async () => {
    const service = createService();
    const input = {
      tenantId: "tenant-1",
      meterId: "quota",
      value: 11,
      idempotencyKey: "quota-rejected",
    };

    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("retryable");
    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("retryable");
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(0);
  });

  it("records a rejected event after a quota increase without allowing overage", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const meter = createMeter("quota-increase-retry", 4);
    meter.billing = "required";
    meter.aggregation = "COUNT";
    meter.unit = "request";
    const redis = createRedisClient(connection);
    const journal = new RedisBillableUsageJournal(redis);
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: {
        ...createMeterRegistry([meter]),
        billableUsageJournal: journal,
      } as unknown as MeterRegistry,
      usageStorage: new RedisUsageStorage(redis),
    });
    const input = {
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      value: 5,
      idempotencyKey: "quota-increase-retry-key",
    };
    const usageQuery = {
      tenantId: input.tenantId,
      meterId: input.meterId,
      period: "billing_cycle" as const,
    };

    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    await expect(service.getUsage(usageQuery)).resolves.toBe(0);
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("retryable");
    await expect(journal.get(input.idempotencyKey)).resolves.toMatchObject({
      failure: { code: "metering/quota-exceeded" },
    });
    await service.record({ ...input, value: 3, idempotencyKey: "quota-increase-other-key" });
    await expect(service.getUsage(usageQuery)).resolves.toBe(3);

    meter.quota = 10;
    await expect(service.record(input)).resolves.toMatchObject(input);
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("completed");
    expect((await journal.get(input.idempotencyKey))?.failure).toBeUndefined();
    await expect(service.getUsage(usageQuery)).resolves.toBe(8);
  });

  it("re-evaluates a rejected service retry and records it once after overage is allowed", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const meter = createMeter("quota-retry", 4);
    meter.billing = "required";
    meter.aggregation = "COUNT";
    meter.unit = "request";
    const redis = createRedisClient(connection);
    const journal = new RedisBillableUsageJournal(redis);
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: {
        ...createMeterRegistry([meter]),
        billableUsageJournal: journal,
      } as unknown as MeterRegistry,
      usageStorage: new RedisUsageStorage(redis),
    });
    const input = {
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      value: 5,
      idempotencyKey: "service-allow-over-quota-retry",
    };
    const usageQuery = {
      tenantId: input.tenantId,
      meterId: input.meterId,
      period: "billing_cycle" as const,
    };

    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    await expect(service.getUsage(usageQuery)).resolves.toBe(0);
    await expect(journal.get(input.idempotencyKey)).resolves.toMatchObject({
      state: "pending",
      failure: { code: "metering/quota-exceeded" },
    });
    await expect(journal.getDiagnostics()).resolves.toMatchObject({
      backlogCount: 1,
      terminalFailureCount: 0,
    });

    meter.allowOverQuota = true;
    await expect(service.record(input)).resolves.toMatchObject(input);
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("completed");
    await expect(service.getUsage(usageQuery)).resolves.toBe(input.value);
    expect((await journal.get(input.idempotencyKey))?.failure).toBeUndefined();
    await expect(
      journal.claimNext({ ownerId: "billing-worker", leaseDurationMs: 1_000 }),
    ).resolves.toMatchObject({ state: "delivering", event: { eventId: input.idempotencyKey } });
  });

  it("rejects changed input without discarding the original rejected retry", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const meter = createMeter("quota-identity", 4);
    const redis = createRedisClient(connection);
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([meter]),
      usageStorage: new RedisUsageStorage(redis),
    });
    const meterRef = defineMeter({
      key: meter.meterId,
      aggregation: "COUNT",
      unit: "request",
      dimensions: { model: dimension.enum(["first", "second"]) },
    });
    const original = {
      tenantId: meter.tenantId,
      eventId: "quota-identity-key",
      value: 5,
      dimensions: { model: "first" as const },
      metadata: { source: { region: "east", tier: "basic" } },
    };

    await expect(service.record(meterRef, original)).rejects.toThrow(QuotaExceededProblem);
    meter.allowOverQuota = true;

    await expect(service.record(meterRef, { ...original, value: 1 })).rejects.toThrow(
      DuplicateRecordProblem,
    );
    await expect(
      service.record(meterRef, { ...original, dimensions: { model: "second" } }),
    ).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getRecordStatus(original.tenantId, meter.meterId, original.eventId),
    ).resolves.toBe("retryable");

    await expect(
      service.record(meterRef, {
        ...original,
        metadata: { source: { tier: "basic", region: "east" } },
      }),
    ).resolves.toMatchObject({ value: original.value, dimensions: original.dimensions });
    await expect(service.record(meterRef, original)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: original.tenantId,
        meterId: meter.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(original.value);
  });

  it("preserves safe integers and empty metadata arrays across a rejected retry", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const meter = createMeter("quota-serialized-identity", 4);
    const redis = createRedisClient(connection);
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([meter]),
      usageStorage: new RedisUsageStorage(redis),
    });
    const input = {
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      value: Number.MAX_SAFE_INTEGER,
      idempotencyKey: "quota-serialized-identity-key",
      metadata: { items: [] },
    };

    await expect(service.record(input)).rejects.toThrow(QuotaExceededProblem);
    meter.allowOverQuota = true;
    await expect(service.record(input)).resolves.toMatchObject({
      value: input.value,
      metadata: input.metadata,
    });
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(input.value);
  });

  it("re-evaluates quota on the first retry after rejection event publication fails", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const meter = createMeter("quota-publish-failure", 4);
    const redis = createRedisClient(connection);
    const publish = vi.fn().mockRejectedValueOnce(new Error("quota publication failed"));
    const eventBus = { publish, subscribe: vi.fn() } as unknown as EventBus;
    const service = new MeteringService({
      idempotencyManager: new IdempotencyManager(redis),
      meterRegistry: createMeterRegistry([meter]),
      usageStorage: new RedisUsageStorage(redis),
      eventBus,
    });
    const input = {
      tenantId: meter.tenantId,
      meterId: meter.meterId,
      value: 5,
      idempotencyKey: "quota-publish-failure-key",
    };

    await expect(service.record(input)).rejects.toThrow("quota publication failed");
    await expect(
      service.getRecordStatus(input.tenantId, input.meterId, input.idempotencyKey),
    ).resolves.toBe("retryable");

    meter.allowOverQuota = true;
    await expect(service.record(input)).resolves.toMatchObject(input);
    await expect(service.record(input)).rejects.toThrow(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(input.value);
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish.mock.calls[0]?.[0]).toBeInstanceOf(QuotaExceededEvent);
    expect(publish.mock.calls[1]?.[0]).toBeInstanceOf(QuotaExceededEvent);
    expect(publish.mock.calls[1]?.[0].eventId).toBe(publish.mock.calls[0]?.[0].eventId);
    expect(publish.mock.calls[2]?.[0]).toBeInstanceOf(UsageRecordedEvent);
  });

  it("persists a rejected quota retry when overage becomes allowed", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usageRecord = createUsageRecord("allow-over-quota-retry");
    const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:allow-over-quota-retry";
    const quotaOptions = {
      tenantId: usageRecord.tenantId,
      meterId: usageRecord.meterId,
      value: usageRecord.value,
      quota: usageRecord.value - 1,
      usageRecord,
    };

    await expect(
      storage.checkAndRecordWithinQuota({ ...quotaOptions, allowOverQuota: false }),
    ).resolves.toEqual({ exceeded: true, newUsage: usageRecord.value });
    expect(await connection.client.get(dedupeKey)).toBe(`quota:1:0:${usageRecord.value}`);
    await expect(
      storage.getUsage({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        period: "billing_cycle",
        startDate: usageRecord.timestamp,
        endDate: usageRecord.timestamp,
      }),
    ).resolves.toBe(0);

    await expect(
      storage.checkAndRecordWithinQuota({ ...quotaOptions, allowOverQuota: true }),
    ).resolves.toEqual({ exceeded: true, newUsage: usageRecord.value });
    expect(await connection.client.get(dedupeKey)).toBe(`quota:1:1:${usageRecord.value}`);
    await expect(
      storage.checkAndRecordWithinQuota({ ...quotaOptions, allowOverQuota: true }),
    ).resolves.toEqual({ exceeded: true, newUsage: usageRecord.value });
    await expect(
      storage.getUsage({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        period: "billing_cycle",
        startDate: usageRecord.timestamp,
        endDate: usageRecord.timestamp,
      }),
    ).resolves.toBe(usageRecord.value);
  });

  it("replays a legacy quota result marker without duplicating usage", async () => {
    if (!connection) {
      throw new Error("Redis test resource did not start");
    }

    const usageRecord = createUsageRecord("legacy-quota-result");
    const usageKey = "usage2:tenant-atomic-record:api_calls:2024-01";
    const dedupeKey = "idem2:record:tenant-atomic-record:api_calls:legacy-quota-result";
    await connection.client.set(dedupeKey, `quota:1:${usageRecord.value}`);
    const storage = new RedisUsageStorage(createRedisClient(connection));

    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usageRecord.tenantId,
        meterId: usageRecord.meterId,
        value: usageRecord.value,
        quota: usageRecord.value - 1,
        allowOverQuota: true,
        usageRecord,
      }),
    ).resolves.toEqual({ exceeded: true, newUsage: usageRecord.value });

    expect(await connection.client.get(dedupeKey)).toBe(`quota:1:${usageRecord.value}`);
    expect(await connection.client.zcard(usageKey)).toBe(0);
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

  it("reconciles transitive mixed-version identities before quota checks", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usage = {
      ...createUsageRecord("v3-key"),
      id: "aaa:alias",
      eventId: "shared-event",
      value: 10,
    };
    const key = "usage2:tenant-atomic-record:api_calls:2024-01";
    const legacyKey = "usage2:tenant-atomic-record:api_calls:2024-01-15";
    await connection.client.zadd(legacyKey, usage.timestamp.getTime(), "legacy:10");
    await connection.client.zadd(
      key,
      usage.timestamp.getTime(),
      "v2-alias:10:v2." +
        encodeURIComponent(JSON.stringify({ idempotencyKey: "legacy", eventId: "shared-event" })),
    );
    await storage.record(usage);
    await storage.record({
      ...usage,
      id: "independent",
      idempotencyKey: "independent",
      eventId: undefined,
      value: 3,
    });
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "day" as const,
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-01-15T23:59:59.999Z"),
    };
    await expect(storage.getUsage(query)).resolves.toBe(13);
    const next = { ...usage, id: "next", idempotencyKey: "next", eventId: undefined, value: 2 };
    const quota = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      value: 2,
      quota: 14,
      allowOverQuota: false,
      usageRecord: next,
    };
    await expect(storage.checkAndRecordWithinQuota(quota)).resolves.toEqual({
      exceeded: true,
      newUsage: 15,
    });
    expect(await connection.client.zcard(key)).toBe(3);
    await expect(
      storage.checkAndRecordWithinQuota({ ...quota, allowOverQuota: true }),
    ).resolves.toEqual({ exceeded: true, newUsage: 15 });
    await expect(storage.getUsage(query)).resolves.toBe(15);
    await storage.deleteUsageRecords(query, await storage.fetchUsageRecords(query));
    expect(await connection.client.zcard(key)).toBe(0);
    expect(await connection.client.zcard(legacyKey)).toBe(0);
  });

  it.each(["value", "timestamp"] as const)(
    "rejects conflicting mixed-version %s before quota or flush writes",
    async (conflict) => {
      assert.isDefined(connection);
      const storage = new RedisUsageStorage(createRedisClient(connection));
      const usage = { ...createUsageRecord("shared"), id: "new:alias", value: 10 };
      const key = "usage2:tenant-atomic-record:api_calls:2024-01";
      await connection.client.zadd(
        key,
        usage.timestamp.getTime(),
        "old:10:v2." + encodeURIComponent(JSON.stringify({ idempotencyKey: "shared" })),
      );
      await storage.record({
        ...usage,
        value: conflict === "value" ? 11 : 10,
        timestamp: new Date(usage.timestamp.getTime() + (conflict === "timestamp" ? 1 : 0)),
      });
      const query = {
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        period: "billing_cycle" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };
      await expect(storage.getUsage(query)).rejects.toBeInstanceOf(RedisProblem);
      const next = { ...usage, id: "next", idempotencyKey: "next", value: 1 };
      await expect(
        storage.checkAndRecordWithinQuota({
          tenantId: usage.tenantId,
          meterId: usage.meterId,
          value: 1,
          quota: 100,
          allowOverQuota: false,
          usageRecord: next,
        }),
      ).rejects.toBeInstanceOf(RedisProblem);
      await expect(storage.deleteUsageRecords(query, [usage])).rejects.toBeInstanceOf(RedisProblem);
      expect(await connection.client.zcard(key)).toBe(2);
      expect(
        await connection.client.exists("idem2:record:tenant-atomic-record:api_calls:next"),
      ).toBe(0);
    },
  );

  it("keeps encoded IDs, legacy reads, quota totals and flush deletion consistent", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usage = { ...createUsageRecord("dedupe:요청"), id: "request:1:🦀%3A", value: 10 };
    const key = "usage2:tenant-atomic-record:api_calls:2024-01";
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "billing_cycle" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };
    await connection.client.zadd(key, usage.timestamp.getTime(), "legacy:3");
    await connection.client.zadd(
      key,
      usage.timestamp.getTime(),
      "prior:4:v2.%7B%22idempotencyKey%22%3A%22prior-key%22%7D",
    );
    await storage.record(usage);
    await expect(storage.getUsage(query)).resolves.toBe(17);
    const next = { ...usage, id: "next:2", idempotencyKey: "next-key", value: 2 };
    const quota = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      quota: 18,
      value: next.value,
      allowOverQuota: false,
      usageRecord: next,
    };
    await expect(storage.checkAndRecordWithinQuota(quota)).resolves.toEqual({
      exceeded: true,
      newUsage: 19,
    });
    await expect(storage.getUsage(query)).resolves.toBe(17);
    await expect(
      storage.checkAndRecordWithinQuota({ ...quota, allowOverQuota: true }),
    ).resolves.toEqual({ exceeded: true, newUsage: 19 });
    const records = await storage.fetchUsageRecords(query);
    expect(records).toContainEqual(usage);
    expect(records).toContainEqual(next);
    expect(records.map(({ id, value, idempotencyKey }) => ({ id, value, idempotencyKey }))).toEqual(
      expect.arrayContaining([
        { id: "legacy", value: 3, idempotencyKey: "legacy" },
        { id: "prior", value: 4, idempotencyKey: "prior-key" },
      ]),
    );
    // An old partition can repeat a logical v2 record; reads reconcile it and deletion removes both representations.
    await connection.client.zadd(
      "usage2:tenant-atomic-record:api_calls:2024-01-15",
      usage.timestamp.getTime(),
      "prior:4:v2.%7B%22idempotencyKey%22%3A%22prior-key%22%7D",
    );
    const dayQuery = {
      ...query,
      period: "day" as const,
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-01-15T23:59:59.999Z"),
    };
    await expect(storage.getUsage(dayQuery)).resolves.toBe(19);
    await storage.deleteUsageRecords(dayQuery, await storage.fetchUsageRecords(dayQuery));
    await expect(storage.getUsage(dayQuery)).resolves.toBe(0);
    expect(await connection.client.zcard(key)).toBe(0);
    expect(await connection.client.zcard("usage2:tenant-atomic-record:api_calls:2024-01-15")).toBe(
      0,
    );
  });

  it("keeps valid UTF-8 boundary code points eligible for quota writes", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const boundary = String.fromCodePoint(
      0x7f,
      0x80,
      0x7ff,
      0x800,
      0xd7ff,
      0xe000,
      0xffff,
      0x10000,
      0x10ffff,
    );
    const usage = {
      ...createUsageRecord(boundary),
      id: boundary,
      eventId: boundary,
      metadata: { [boundary]: boundary },
      value: 10,
    };
    await storage.record(usage);
    const next = { ...usage, id: "next", idempotencyKey: "next", eventId: undefined, value: 2 };
    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        value: 2,
        quota: 12,
        allowOverQuota: false,
        usageRecord: next,
      }),
    ).resolves.toEqual({ exceeded: false, newUsage: 12 });
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "billing_cycle" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };
    await expect(storage.getUsage(query)).resolves.toBe(12);
    await expect(storage.fetchUsageRecords(query)).resolves.toContainEqual(usage);
  });

  it("rejects unpaired envelope strings before writing usage or a dedupe marker", async () => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usage = { ...createUsageRecord("unpaired"), metadata: { tag: "\ud800" } };
    await expect(storage.record(usage)).rejects.toBeInstanceOf(RedisProblem);
    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        value: usage.value,
        quota: 100,
        allowOverQuota: false,
        usageRecord: usage,
      }),
    ).rejects.toBeInstanceOf(RedisProblem);
    expect(await connection.client.zcard("usage2:tenant-atomic-record:api_calls:2024-01")).toBe(0);
    expect(await connection.client.keys("idem2:*")).toEqual([]);
  });

  it.each([
    { kind: "object", layers: 998, allowed: true },
    { kind: "object", layers: 999, allowed: false },
    { kind: "array", layers: 998, allowed: true },
    { kind: "array", layers: 999, allowed: false },
  ])("aligns $kind JSON nesting at $layers layers with Lua", async ({ kind, layers, allowed }) => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    let nested: unknown = 0;
    for (let index = 0; index < layers; index += 1) {
      nested = kind === "object" ? { nested } : [nested];
    }
    const usage = { ...createUsageRecord("depth"), value: 10, metadata: { nested } };
    const next = { ...createUsageRecord("next"), value: 3 };
    const quota = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      value: 3,
      quota: 13,
      allowOverQuota: false,
      usageRecord: next,
    };
    const key = "usage2:tenant-atomic-record:api_calls:2024-01";
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "billing_cycle" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };
    if (allowed) {
      await storage.record(usage);
      await expect(storage.checkAndRecordWithinQuota(quota)).resolves.toEqual({
        exceeded: false,
        newUsage: 13,
      });
      await expect(storage.getUsage(query)).resolves.toBe(13);
      return;
    }
    await expect(storage.record(usage)).rejects.toBeInstanceOf(RedisProblem);
    await expect(
      storage.checkAndRecordWithinQuota({ ...quota, usageRecord: usage, value: 10 }),
    ).rejects.toBeInstanceOf(RedisProblem);
    expect(await connection.client.zcard(key)).toBe(0);
    const member = `deep:10:v3.${encodeURIComponent(JSON.stringify({ metadata: usage.metadata }))}`;
    await connection.client.zadd(key, usage.timestamp.getTime(), member);
    await expect(storage.getUsage(query)).rejects.toBeInstanceOf(RedisProblem);
    await expect(storage.fetchUsageRecords(query)).rejects.toBeInstanceOf(RedisProblem);
    await expect(storage.deleteUsageRecords(query, [usage])).rejects.toBeInstanceOf(RedisProblem);
    await expect(storage.checkAndRecordWithinQuota(quota)).rejects.toBeInstanceOf(RedisProblem);
    expect(await connection.client.zrange(key, 0, -1)).toEqual([member]);
    expect(await connection.client.keys("idem2:*")).toEqual([]);
  });

  it("accepts valid JSON grammar without changing the shared Lua decoder", async () => {
    assert.isDefined(connection);
    const before = await connection.client.eval(
      "return cjson.decode_invalid_numbers() and 1 or 0",
      0,
    );
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usage = {
      ...createUsageRecord("json-grammar"),
      value: 10,
      metadata: {
        note: 'NaN 1. "escaped" \\ end',
        fraction: 1.5,
        exponent: 1e21,
        literalBrackets: "[".repeat(1_001),
      },
    };
    await storage.record(usage);
    await connection.client.zadd(
      "usage2:tenant-atomic-record:api_calls:2024-01",
      usage.timestamp.getTime(),
      `legacy:2:${encodeURIComponent(' \t{ "source": "legacy" }\r\n')}`,
    );
    const next = { ...createUsageRecord("next"), value: 3 };
    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        value: 3,
        quota: 15,
        allowOverQuota: false,
        usageRecord: next,
      }),
    ).resolves.toEqual({ exceeded: false, newUsage: 15 });
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "billing_cycle" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };
    await expect(storage.getUsage(query)).resolves.toBe(15);
    await expect(storage.fetchUsageRecords(query)).resolves.toContainEqual(usage);
    expect(
      await connection.client.eval("return cjson.decode_invalid_numbers() and 1 or 0", 0),
    ).toBe(before);
  });

  it.each([
    "request:1:10",
    "request:1:10:v2.%7B%7D",
    "request:1:v2.invalid",
    ...[
      "%FF",
      "%80",
      "%C0%AF",
      "%C2%41",
      "%E0%80%AF",
      "%ED%A0%80",
      "%E2%82",
      "%F0%80%80%AF",
      "%F0%90%41%80",
      "%F4%90%80%80",
    ].map((id) => `${id}:10:v3.%7B%7D`),
    "record:10:v3.%7B%22metadata%22%3A%7B%22tag%22%3A%22%FF%22%7D%7D",
    ...[
      { eventId: "\ud800" },
      { idempotencyKey: "\ud800" },
      { metadata: { tag: "\ud800" } },
      { metadata: { ["\ud800"]: "tag" } },
    ].map((envelope) => `record:10:v3.${encodeURIComponent(JSON.stringify(envelope))}`),
    ...["NaN", "Infinity", "0x10", "01", "1."].map(
      (value) => `record:10:v3.${encodeURIComponent(`{"metadata":{"value":${value}}}`)}`,
    ),
    `record:10:v3.${encodeURIComponent('{"metadata":{"tag":"line\nfeed"}}')}`,
    ...[
      '{"metadata":"\\ud800","metadata":{}}',
      '{"idempotencyKey":"\\ud800","idempotencyKey":"valid"}',
      `{"metadata":${"[".repeat(1_000)}0${"]".repeat(1_000)},"metadata":{}}`,
      `{"metadata":${'{"nested":'.repeat(1_000)}0${"}".repeat(1_000)},"metadata":{}}`,
    ].map((json) => `record:10:v3.${encodeURIComponent(json)}`),
  ])("rejects invalid stored member %s in Lua before any write", async (member) => {
    assert.isDefined(connection);
    const storage = new RedisUsageStorage(createRedisClient(connection));
    const usage = createUsageRecord("invalid-member");
    const key = "usage2:tenant-atomic-record:api_calls:2024-01";
    await connection.client.zadd(key, usage.timestamp.getTime(), member);
    const query = {
      tenantId: usage.tenantId,
      meterId: usage.meterId,
      period: "billing_cycle" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };
    await expect(storage.getUsage(query)).rejects.toBeInstanceOf(RedisProblem);
    await expect(storage.fetchUsageRecords(query)).rejects.toBeInstanceOf(RedisProblem);
    await expect(storage.deleteUsageRecords(query, [usage])).rejects.toBeInstanceOf(RedisProblem);
    await expect(
      storage.checkAndRecordWithinQuota({
        tenantId: usage.tenantId,
        meterId: usage.meterId,
        value: usage.value,
        quota: 100,
        allowOverQuota: false,
        usageRecord: usage,
      }),
    ).rejects.toBeInstanceOf(RedisProblem);
    expect(await connection.client.zrange(key, 0, -1)).toEqual([member]);
    expect(
      await connection.client.exists("idem2:record:tenant-atomic-record:api_calls:invalid-member"),
    ).toBe(0);
  });

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
    "quota:0:0:5",
    "quota:1:2:5",
    "quota:1:0:bad",
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

  it("claims only activated billable entries beyond a full page of stale inactive intents", async () => {
    assert.isDefined(connection);
    const journal = new RedisBillableUsageJournal(createRedisClient(connection));
    const event: BillableUsageEvent = {
      eventId: "approved",
      tenantId: "tenant-1",
      meterId: "requests",
      aggregation: "COUNT",
      unit: "request",
      value: 7,
      dimensions: {},
    };
    for (let index = 0; index < 151; index += 1) {
      const eventId = `inactive-${index}`;
      await journal.append({ ...event, eventId });
      // Seed a stale delivery-index member without changing the durable intent.
      await connection.client.zadd("billable-journal:pending", 0, eventId);
    }
    await expect(
      journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
    ).resolves.toBeNull();
    await journal.append(event);
    await expect(journal.append(event)).resolves.toMatchObject({ outcome: "duplicate" });
    await expect(
      journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
    ).resolves.toBeNull();
    // Reintroduce stale index entries so one claim must reach past the first 100.
    for (let index = 0; index < 151; index += 1) {
      await connection.client.zadd("billable-journal:pending", 0, `inactive-${index}`);
    }
    await journal.markDeliverable(event.eventId);
    const claim = await journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 });
    assert.isNotNull(claim);
    expect(claim.event).toEqual(event);
    await journal.markAccepted(claim);
    await expect(journal.get("inactive-150")).resolves.toMatchObject({ state: "pending" });
    await expect(journal.getDiagnostics()).resolves.toMatchObject({ backlogCount: 151 });
    await journal.markDeliverable("inactive-150");
    await expect(
      journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
    ).resolves.toMatchObject({
      event: { eventId: "inactive-150" },
      state: "delivering",
    });
  });

  it.each(["record", "quota"] as const)(
    "keeps billable %s persistence pending and rejected intents out of delivery",
    async (path) => {
      assert.isDefined(connection);
      const redis = createRedisClient(connection);
      const journal = new RedisBillableUsageJournal(redis);
      const storage = new RedisUsageStorage(redis);
      const meter = createMeter("billable-barrier", path === "quota" ? 4 : undefined);
      meter.billing = "required";
      const entered = deferred();
      const release = deferred();
      const recordWithinQuota = storage.checkAndRecordWithinQuota.bind(storage);
      if (path === "record") {
        vi.spyOn(storage, "record").mockImplementation(async () => {
          entered.resolve();
          await release.promise;
          throw new Error("Injected storage rejection");
        });
      } else {
        vi.spyOn(storage, "checkAndRecordWithinQuota").mockImplementation(async (options) => {
          entered.resolve();
          await release.promise;
          return recordWithinQuota(options);
        });
      }
      const service = new MeteringService({
        idempotencyManager: new IdempotencyManager(redis),
        meterRegistry: {
          ...createMeterRegistry([meter]),
          billableUsageJournal: journal,
        } as unknown as MeterRegistry,
        usageStorage: storage,
      });
      const input = {
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        value: 5,
        idempotencyKey: "barrier-event",
      };
      const rejected = expect(service.record(input)).rejects.toThrow(
        path === "record" ? "Injected storage rejection" : QuotaExceededProblem,
      );
      try {
        await entered.promise;
        await expect(
          journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
        ).resolves.toBeNull();
        await connection.client.zadd("billable-journal:pending", 0, input.idempotencyKey);
        await expect(
          journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
        ).resolves.toBeNull();
      } finally {
        release.resolve();
        await rejected;
        vi.restoreAllMocks();
      }
      await expect(
        journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
      ).resolves.toBeNull();
      if (path === "quota") meter.allowOverQuota = true;
      await service.record(input);
      await expect(
        journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
      ).resolves.toMatchObject({
        event: { eventId: input.idempotencyKey, value: 5 },
        state: "delivering",
      });
    },
  );

  it.each(["pending", "retryable-failed", "delivering"])(
    "refuses stale %s entries without activation evidence",
    async (state) => {
      assert.isDefined(connection);
      const journal = new RedisBillableUsageJournal(createRedisClient(connection));
      const event: BillableUsageEvent = {
        eventId: "unapproved",
        tenantId: "tenant-1",
        meterId: "requests",
        aggregation: "COUNT",
        unit: "request",
        value: 3,
        dimensions: {},
      };
      await journal.append(event);
      const key = "billable-journal:event:unapproved";
      const stored = JSON.parse((await connection.client.get(key)) ?? "{}");
      Object.assign(stored, { state, retryAt: 0, leaseExpiresAt: 0, deliverableAt: null });
      await connection.client.set(key, JSON.stringify(stored));
      await connection.client.zadd("billable-journal:pending", 0, event.eventId);
      await expect(
        journal.claimNext({ ownerId: "worker", leaseDurationMs: 10_000 }),
      ).resolves.toBeNull();
      expect(JSON.parse((await connection.client.get(key)) ?? "{}")).toEqual(stored);
      await expect(
        connection.client.zscore("billable-journal:pending", event.eventId),
      ).resolves.toBeNull();
      await expect(journal.getDiagnostics()).resolves.toMatchObject({ backlogCount: 1 });
    },
  );

  it("preserves activated retry scheduling and leases while pruning stale delivery indexes", async () => {
    assert.isDefined(connection);
    const journal = new RedisBillableUsageJournal(createRedisClient(connection));
    const event: BillableUsageEvent = {
      eventId: "retry-schedule",
      tenantId: "tenant-1",
      meterId: "requests",
      aggregation: "COUNT",
      unit: "request",
      value: 9,
      dimensions: {},
    };
    await journal.append(event);
    await journal.markDeliverable(event.eventId);
    const first = await journal.claimNext({ ownerId: "worker-1", leaseDurationMs: 60_000 });
    assert.isNotNull(first);
    await connection.client.zadd("billable-journal:pending", 0, event.eventId);
    await expect(
      journal.claimNext({ ownerId: "worker-2", leaseDurationMs: 60_000 }),
    ).resolves.toBeNull();
    await expect(journal.get(event.eventId)).resolves.toEqual(first);
    const retryAt = new Date(Date.now() + 60_000);
    const failure = { code: "provider/unavailable", message: "Retry later" };
    const retry = await journal.markRetryableFailed(first, failure, retryAt);
    await expect(journal.markDeliverable(event.eventId)).resolves.toEqual(retry);
    await expect(journal.append(event)).resolves.toMatchObject({
      outcome: "duplicate",
      entry: retry,
    });
    await connection.client.zadd("billable-journal:pending", 0, event.eventId);
    await expect(
      journal.claimNext({ ownerId: "worker-2", leaseDurationMs: 60_000 }),
    ).resolves.toBeNull();
    expect(Number(await connection.client.zscore("billable-journal:pending", event.eventId))).toBe(
      retryAt.getTime(),
    );
    // Advance the stored retry deadline rather than sleeping on the worker clock.
    const stored = JSON.parse(
      (await connection.client.get("billable-journal:event:retry-schedule")) ?? "{}",
    );
    stored.retryAt = 0;
    await connection.client.set("billable-journal:event:retry-schedule", JSON.stringify(stored));
    await connection.client.zadd("billable-journal:pending", 0, event.eventId);
    const second = await journal.claimNext({ ownerId: "worker-2", leaseDurationMs: 60_000 });
    assert.isNotNull(second);
    expect(second.fencingToken).toBeGreaterThan(first.fencingToken);
    expect(second.retryCount).toBe(1);
    await expect(journal.markAccepted(first)).rejects.toMatchObject({
      code: "metering/transition-conflict",
    });
    await journal.markAccepted(second);
    await connection.client.zadd("billable-journal:pending", 0, event.eventId);
    await expect(
      journal.claimNext({ ownerId: "worker-3", leaseDurationMs: 60_000 }),
    ).resolves.toBeNull();
    await expect(journal.getDiagnostics()).resolves.toMatchObject({
      backlogCount: 0,
      retryCount: 1,
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
