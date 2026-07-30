import { redisResource, type RedisTestConnection } from "@croco/testing-resources";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IdempotencyManager } from "../libs/IdempotencyManager";
import { MeteringService } from "../libs/MeteringService";
import type { MeterRegistry } from "../libs/MeterRegistry";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import type { RedisClient } from "../libs/RedisClient";
import { RedisUsageStorage } from "../libs/RedisUsageStorage";
import type { MeterDefinition } from "../libs/types";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";

function createRedisClient(connection: RedisTestConnection): RedisClient {
  return {
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

  afterAll(async () => {
    await dispose?.();
  });

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
        `${connection.keyPrefix}idem2:lifecycle:tenant-1:${meterId}:${idempotencyKey}`,
        `${connection.keyPrefix}idem2:record:tenant-1:${meterId}:${idempotencyKey}`,
      ].sort(),
    );
  }

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
    await expect(service.record(input)).rejects.toBeInstanceOf(DuplicateRecordProblem);
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
    await expect(service.record(input)).rejects.toBeInstanceOf(DuplicateRecordProblem);
    await expect(
      service.getUsage({
        tenantId: input.tenantId,
        meterId: input.meterId,
        period: "billing_cycle",
      }),
    ).resolves.toBe(4);
  });
});
