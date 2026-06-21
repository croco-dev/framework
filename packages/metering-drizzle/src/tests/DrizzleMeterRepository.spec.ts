import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ILogger } from "@croco/framework-context";
import { MeterRegistry } from "@croco/metering-core";
import { ProblemFactory } from "@croco/problems-core";
import {
  assertDrizzleProblem,
  createDrizzleProviderConformanceSuite,
} from "@croco/testing/drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter, DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { type DrizzleDb, DrizzleMeterRepository } from "../libs/DrizzleMeterRepository";
import { metersSqlite, usageRecordsSqlite } from "../libs/schema";

const createRepositoryConfig = () => ({
  meterTable: metersSqlite,
  meterSchema: {
    id: metersSqlite.id,
    tenantId: metersSqlite.tenantId,
    meterId: metersSqlite.meterId,
    type: metersSqlite.type,
    quota: metersSqlite.quota,
    allowOverQuota: metersSqlite.allowOverQuota,
    metadata: metersSqlite.metadata,
    createdAt: metersSqlite.createdAt,
    updatedAt: metersSqlite.updatedAt,
  },
  usageRecordTable: usageRecordsSqlite,
  usageRecordSchema: {
    id: usageRecordsSqlite.id,
    tenantId: usageRecordsSqlite.tenantId,
    meterId: usageRecordsSqlite.meterId,
    value: usageRecordsSqlite.value,
    recordedAt: usageRecordsSqlite.recordedAt,
    metadata: usageRecordsSqlite.metadata,
    idempotencyKey: usageRecordsSqlite.idempotencyKey,
  },
});

type DrizzleOperationName = "delete" | "insert" | "select" | "update";

function createObservedDrizzleClient(
  db: DrizzleDb,
  observe: (operation: DrizzleOperationName) => void,
): DrizzleDb {
  const observedOperations = new Set<PropertyKey>(["delete", "insert", "select", "update"]);

  return new Proxy(db as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return value;
      }

      return (...args: unknown[]) => {
        if (observedOperations.has(property)) {
          observe(property as DrizzleOperationName);
        }

        return value.apply(target, args);
      };
    },
  }) as DrizzleDb;
}

function createSqliteTransactionHarness(sqlite: Database.Database, db: DrizzleDb) {
  let active = false;
  const transactionOperations: DrizzleOperationName[] = [];
  const fallbackClient = createObservedDrizzleClient(db, (operation) => {
    if (active) {
      throw ProblemFactory.internalServerError(
        "testing/fallback-client-used",
        `fallback Drizzle client used during active transaction: ${operation}`,
      );
    }
  });
  const transactionClient = createObservedDrizzleClient(db, (operation) => {
    transactionOperations.push(operation);
  });
  const getClient = vi.fn(() => (active ? transactionClient : null));
  const txManagerDouble = {
    getClient,
  } as unknown as TxManager<DrizzleDb>;
  const transactionRepository = new DrizzleMeterRepository(
    fallbackClient,
    txManagerDouble,
    createRepositoryConfig(),
  );

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    sqlite.exec("BEGIN");
    active = true;

    try {
      const result = await fn();
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    } finally {
      active = false;
    }
  };

  return {
    getClient,
    operations: transactionOperations,
    repository: transactionRepository,
    run,
  };
}

describe("DrizzleMeterRepository", () => {
  let repository!: DrizzleMeterRepository;
  let sqlite!: Database.Database;
  let db!: DrizzleDb;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txManager!: TxManager<any, any>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite) as DrizzleDb;

    sqlite.exec(`
      CREATE TABLE meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        meter_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quota INTEGER,
        allow_over_quota INTEGER NOT NULL DEFAULT 0,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    sqlite.exec(`
      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        meter_id TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 1,
        recorded_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        idempotency_key TEXT
      )
    `);

    sqlite.exec(`
      CREATE UNIQUE INDEX usage_records_idempotency_unique
        ON usage_records (tenant_id, meter_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);

    const adapter = createDrizzleTxAdapter(
      db as unknown as Parameters<typeof createDrizzleTxAdapter>[0],
    );
    txManager = new TxManager(adapter, { defaultNesting: "join" });

    repository = new DrizzleMeterRepository(db, txManager, createRepositoryConfig());
  });

  describe("drizzle provider conformance", () => {
    it.each(
      createDrizzleProviderConformanceSuite({
        providerName: "metering-drizzle",
        schema: {
          supported: true,
          checks: [
            {
              name: "declares local meter and usage tables with idempotency index",
              run: async () => {
                const tables = sqlite
                  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
                  .all() as Array<{
                  name: string;
                }>;
                const tableNames = tables.map((table) => table.name);

                expect(tableNames).toEqual(expect.arrayContaining(["meters", "usage_records"]));

                const usageColumns = sqlite
                  .prepare("PRAGMA table_info('usage_records')")
                  .all() as Array<{
                  name: string;
                  notnull: number;
                }>;
                expect(usageColumns).toEqual(
                  expect.arrayContaining([
                    expect.objectContaining({ name: "tenant_id", notnull: 1 }),
                    expect.objectContaining({ name: "meter_id", notnull: 1 }),
                    expect.objectContaining({ name: "idempotency_key" }),
                  ]),
                );

                const usageIndexes = sqlite
                  .prepare("PRAGMA index_list('usage_records')")
                  .all() as Array<{
                  name: string;
                  unique: number;
                }>;
                expect(usageIndexes).toEqual(
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: "usage_records_idempotency_unique",
                      unique: 1,
                    }),
                  ]),
                );
              },
            },
          ],
        },
        diagnostics: {
          supported: true,
          checks: [
            {
              name: "redacts database connection details from readiness failures",
              run: async () => {
                const detail =
                  "failed postgres://metering:metering-secret@db.example/app?password=query-secret token=raw-token";
                const indicator = new DrizzleHealthIndicator(
                  {
                    transaction: vi
                      .fn()
                      .mockRejectedValue(
                        ProblemFactory.internalServerError(
                          "testing/drizzle-readiness-failed",
                          detail,
                        ),
                      ),
                  } as never,
                  { name: "metering-drizzle" },
                );
                const health = await indicator.check();
                const serialized = JSON.stringify(health);

                expect(health.status).toBe("down");
                expect(serialized).not.toContain("metering-secret");
                expect(serialized).not.toContain("query-secret");
                expect(serialized).not.toContain("raw-token");
                expect(health.details?.error).toBe(
                  "failed postgres://[redacted]@db.example/app?password=[redacted] token=[redacted]",
                );
              },
            },
          ],
        },
        transaction: {
          participation: {
            supported: true,
            checks: [
              {
                name: "persists writes through the active transaction client",
                run: async () => {
                  const transaction = createSqliteTransactionHarness(sqlite, db);

                  await transaction.run(async () => {
                    await transaction.repository.save({
                      tenantId: "tenant-conformance-tx",
                      meterId: "transaction_participation",
                      type: "COUNT",
                    });
                  });

                  const meter = await repository.findByMeterIdAndTenant(
                    "transaction_participation",
                    "tenant-conformance-tx",
                  );
                  expect(meter?.meterId).toBe("transaction_participation");
                  expect(transaction.getClient).toHaveBeenCalled();
                  expect(transaction.operations).toContain("insert");
                },
              },
            ],
          },
          rollback: {
            supported: true,
            checks: [
              {
                name: "rolls back repository writes when the transaction fails",
                run: async () => {
                  const transaction = createSqliteTransactionHarness(sqlite, db);

                  await expect(
                    transaction.run(async () => {
                      await transaction.repository.save({
                        tenantId: "tenant-conformance-rollback",
                        meterId: "rollback_target",
                        type: "COUNT",
                      });
                      throw ProblemFactory.internalServerError(
                        "testing/force-rollback",
                        "force rollback",
                      );
                    }),
                  ).rejects.toThrow("force rollback");

                  await expect(
                    repository.findByMeterIdAndTenant(
                      "rollback_target",
                      "tenant-conformance-rollback",
                    ),
                  ).resolves.toBeNull();
                  expect(transaction.operations).toContain("insert");
                },
              },
            ],
          },
        },
        tenantIsolation: {
          supported: true,
          checks: [
            {
              name: "keeps meter definitions scoped by tenant",
              run: async () => {
                await repository.save({
                  tenantId: "tenant-conformance-a",
                  meterId: "shared_meter",
                  type: "COUNT",
                });
                await repository.save({
                  tenantId: "tenant-conformance-b",
                  meterId: "shared_meter",
                  type: "COUNT",
                });

                const tenantAMeters = await repository.findByTenant("tenant-conformance-a");
                const tenantBMeters = await repository.findByTenant("tenant-conformance-b");

                expect(tenantAMeters).toHaveLength(1);
                expect(tenantAMeters[0]?.tenantId).toBe("tenant-conformance-a");
                expect(tenantBMeters).toHaveLength(1);
                expect(tenantBMeters[0]?.tenantId).toBe("tenant-conformance-b");
              },
            },
          ],
        },
        repositoryErrors: {
          notFound: {
            supported: true,
            checks: [
              {
                name: "reports missing meters with a deterministic Problem code",
                run: async () => {
                  const registry = new MeterRegistry(repository, 0);

                  await assertDrizzleProblem(
                    () => registry.getOrThrow("tenant-conformance-missing", "missing_meter"),
                    {
                      code: "metering/invalid-meter",
                      status: 404,
                    },
                  );
                },
              },
            ],
          },
          validation: {
            supported: false,
            reason:
              "Meter validation lives in metering-core services, not this Drizzle repository.",
          },
          duplicate: {
            supported: true,
            checks: [
              {
                name: "deduplicates usage records by tenant meter and idempotency key",
                run: async () => {
                  const record = {
                    id: "record-conformance-1",
                    tenantId: "tenant-conformance-duplicate",
                    meterId: "api_calls",
                    value: 1,
                    timestamp: new Date("2026-01-01T00:00:00.000Z"),
                    idempotencyKey: "idem-conformance",
                  };

                  await repository.saveUsageRecords([record]);
                  await repository.saveUsageRecords([record]);

                  const rows = sqlite
                    .prepare(
                      "SELECT * FROM usage_records WHERE tenant_id = ? AND meter_id = ? AND idempotency_key = ?",
                    )
                    .all("tenant-conformance-duplicate", "api_calls", "idem-conformance");

                  expect(rows).toHaveLength(1);
                },
              },
            ],
          },
          conflict: {
            supported: false,
            reason: "Usage idempotency conflicts are modeled as deterministic no-op inserts.",
          },
          retryableFailure: {
            supported: false,
            reason:
              "The repository has no retryable upstream boundary in the local SQLite fixture.",
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("save", () => {
    it("should create meter definition", async () => {
      const meter = await repository.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
        quota: 10000,
        allowOverQuota: false,
        metadata: { description: "API calls per month" },
      });

      expect(meter.id).toBeDefined();
      expect(meter.tenantId).toBe("tenant-1");
      expect(meter.meterId).toBe("api_calls");
      expect(meter.type).toBe("COUNT");
      expect(meter.quota).toBe(10000);
      expect(meter.allowOverQuota).toBe(false);
      expect(meter.metadata).toEqual({ description: "API calls per month" });
      expect(meter.createdAt).toBeInstanceOf(Date);
      expect(meter.updatedAt).toBeInstanceOf(Date);
    });

    it("should create meter without optional fields", async () => {
      const meter = await repository.save({
        tenantId: "tenant-1",
        meterId: "storage_bytes",
        type: "COUNT",
      });

      expect(meter.id).toBeDefined();
      expect(meter.tenantId).toBe("tenant-1");
      expect(meter.meterId).toBe("storage_bytes");
      expect(meter.type).toBe("COUNT");
      expect(meter.quota).toBeUndefined();
      expect(meter.allowOverQuota).toBe(false);
      expect(meter.metadata).toBeUndefined();
    });

    it("should handle allowOverQuota true", async () => {
      const meter = await repository.save({
        tenantId: "tenant-1",
        meterId: "bandwidth",
        type: "COUNT",
        allowOverQuota: true,
      });

      expect(meter.allowOverQuota).toBe(true);
    });
  });

  describe("findByMeterIdAndTenant", () => {
    beforeEach(async () => {
      await repository.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
        quota: 10000,
      });
    });

    it("should find meter by meterId and tenantId", async () => {
      const meter = await repository.findByMeterIdAndTenant("api_calls", "tenant-1");

      expect(meter).not.toBeNull();
      expect(meter?.meterId).toBe("api_calls");
      expect(meter?.tenantId).toBe("tenant-1");
      expect(meter?.quota).toBe(10000);
    });

    it("should return null when meter not found", async () => {
      const meter = await repository.findByMeterIdAndTenant("nonexistent", "tenant-1");

      expect(meter).toBeNull();
    });

    it("should return null when tenant not found", async () => {
      const meter = await repository.findByMeterIdAndTenant("api_calls", "tenant-nonexistent");

      expect(meter).toBeNull();
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await repository.save({ tenantId: "tenant-1", meterId: "api_calls", type: "COUNT" });
      await repository.save({ tenantId: "tenant-1", meterId: "storage", type: "COUNT" });
      await repository.save({ tenantId: "tenant-2", meterId: "api_calls", type: "COUNT" });
    });

    it("should return all meters", async () => {
      const meters = await repository.findAll();

      expect(meters).toHaveLength(3);
    });

    it("should return empty array when no meters", async () => {
      const sqlite2 = new Database(":memory:");
      const db2 = drizzle(sqlite2) as DrizzleDb;
      sqlite2.exec(`
        CREATE TABLE meters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL,
          meter_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quota INTEGER,
          allow_over_quota INTEGER NOT NULL DEFAULT 0,
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      const emptyRepo = new DrizzleMeterRepository(db2, txManager, createRepositoryConfig());

      const meters = await emptyRepo.findAll();
      expect(meters).toHaveLength(0);
    });
  });

  describe("findByTenant", () => {
    beforeEach(async () => {
      await repository.save({ tenantId: "tenant-1", meterId: "api_calls", type: "COUNT" });
      await repository.save({ tenantId: "tenant-1", meterId: "storage", type: "COUNT" });
      await repository.save({ tenantId: "tenant-2", meterId: "api_calls", type: "COUNT" });
    });

    it("should return meters for specific tenant", async () => {
      const meters = await repository.findByTenant("tenant-1");

      expect(meters).toHaveLength(2);
      expect(meters.every((m) => m.tenantId === "tenant-1")).toBe(true);
    });

    it("should return empty array when tenant has no meters", async () => {
      const meters = await repository.findByTenant("tenant-nonexistent");

      expect(meters).toHaveLength(0);
    });
  });

  describe("saveUsageRecords", () => {
    it("should save usage records", async () => {
      await repository.saveUsageRecords([
        {
          id: "record-1",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 1,
          timestamp: new Date(),
          idempotencyKey: "idem-1",
          metadata: { endpoint: "/api/users" },
        },
        {
          id: "record-2",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 1,
          timestamp: new Date(),
          idempotencyKey: "idem-2",
          metadata: { endpoint: "/api/orders" },
        },
      ]);

      const result = sqlite.prepare("SELECT * FROM usage_records").all();
      expect(result).toHaveLength(2);
    });

    it("should handle empty array", async () => {
      await repository.saveUsageRecords([]);

      const result = sqlite.prepare("SELECT * FROM usage_records").all();
      expect(result).toHaveLength(0);
    });

    it("should save records without metadata", async () => {
      await repository.saveUsageRecords([
        {
          id: "record-1",
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          timestamp: new Date(),
          idempotencyKey: "idem-1",
        },
      ]);

      const result = sqlite.prepare("SELECT * FROM usage_records").all() as Array<{
        tenant_id: string;
        meter_id: string;
        value: number;
        idempotency_key: string;
      }>;
      expect(result).toHaveLength(1);
      expect(result[0].tenant_id).toBe("tenant-1");
      expect(result[0].meter_id).toBe("api_calls");
      expect(result[0].value).toBe(5);
      expect(result[0].idempotency_key).toBe("idem-1");
    });

    it("should ignore duplicate idempotency keys", async () => {
      const record = {
        id: "record-1",
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1,
        timestamp: new Date(),
        idempotencyKey: "idem-1",
      };

      await repository.saveUsageRecords([record]);
      await repository.saveUsageRecords([record]);

      const result = sqlite
        .prepare("SELECT * FROM usage_records WHERE idempotency_key = ?")
        .all("idem-1");
      expect(result).toHaveLength(1);
    });

    it("should keep latest usage record when deduplicating idempotency rows", () => {
      sqlite.exec("DROP INDEX usage_records_idempotency_unique");

      const insert = sqlite.prepare(`
        INSERT INTO usage_records (tenant_id, meter_id, value, recorded_at, metadata, idempotency_key)
        VALUES (?, ?, ?, ?, '{}', ?)
      `);
      insert.run("tenant-1", "api_calls", 1, 1000, "idem-1");
      insert.run("tenant-1", "api_calls", 2, 3000, "idem-1");
      insert.run("tenant-1", "api_calls", 3, 2000, "idem-1");

      sqlite.exec(`
        DELETE FROM usage_records AS a
         WHERE EXISTS (
           SELECT 1
             FROM usage_records AS b
            WHERE a.tenant_id = b.tenant_id
              AND a.meter_id = b.meter_id
              AND a.idempotency_key = b.idempotency_key
              AND a.idempotency_key IS NOT NULL
              AND (a.recorded_at < b.recorded_at
                   OR (a.recorded_at = b.recorded_at AND a.id < b.id))
         )
      `);

      const result = sqlite
        .prepare("SELECT recorded_at, value FROM usage_records WHERE idempotency_key = ?")
        .all("idem-1") as Array<{ recorded_at: number; value: number }>;
      expect(result).toEqual([{ recorded_at: 3000, value: 2 }]);
    });
  });

  describe("deserializeMetadata JSON parse failure", () => {
    it("should log warn and return undefined on invalid JSON", async () => {
      const logger = { warn: vi.fn() } as unknown as ILogger;
      const repoWithLogger = new DrizzleMeterRepository(
        db,
        txManager,
        createRepositoryConfig(),
        logger,
      );

      sqlite
        .prepare(
          `INSERT INTO meters (tenant_id, meter_id, type, quota, allow_over_quota, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("tenant-1", "bad_json", "COUNT", null, 0, "{invalid json}", Date.now(), Date.now());

      const result = await repoWithLogger.findByMeterIdAndTenant("bad_json", "tenant-1");

      expect(result).not.toBeNull();
      expect(result!.meterId).toBe("bad_json");
      expect(result!.metadata).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith("Failed to deserialize metadata JSON", {
        error: expect.any(SyntaxError),
      });
    });
  });

  describe("transaction support", () => {
    it("should use getClient when in transaction context", async () => {
      const txDb = {
        insert: db.insert.bind(db),
        select: db.select.bind(db),
      } as DrizzleDb;

      const mockTxManager = {
        getClient: () => txDb,
        run: async (fn: () => Promise<void>) => fn(),
      } as unknown as TxManager<DrizzleDb>;

      const repoWithMockTx = new DrizzleMeterRepository(
        db,
        mockTxManager,
        createRepositoryConfig(),
      );

      const meter = await repoWithMockTx.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
      });

      expect(meter.id).toBeDefined();

      const found = await repoWithMockTx.findByMeterIdAndTenant("api_calls", "tenant-1");
      expect(found).not.toBeNull();
    });
  });
});
