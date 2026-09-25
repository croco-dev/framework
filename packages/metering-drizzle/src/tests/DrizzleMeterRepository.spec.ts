import type { ILogger } from "@croco/framework-context";
import { InvalidUsageValueProblem, MeterRegistry, UsageAggregator } from "@croco/metering-core";
import type {
  BillableUsageJournal,
  MeterRegistrationOptions,
  UsageRecord,
  UsageStorage,
} from "@croco/metering-core";
import { ProblemFactory } from "@croco/problems-core";
import {
  assertDrizzleProblem,
  createDrizzleProviderConformanceSuite,
} from "@croco/testing/drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter, DrizzleHealthIndicator } from "@croco/tx-drizzle";
import Database from "better-sqlite3";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  bigint,
  getTableConfig as getPgTableConfig,
  jsonb,
  pgTable,
  PgDialect,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type DrizzleMeterDatabase,
  DrizzleMeterRepository,
  type DrizzleMeterRepositoryConfig,
} from "../libs/DrizzleMeterRepository";
import { DuplicateMeterDefinitionsProblem } from "../libs/problems/DuplicateMeterDefinitionsProblem";
import { InvalidMeterDefinitionProblem } from "../libs/problems/InvalidMeterDefinitionProblem";
import { metersPg, metersSqlite, usageRecordsPg, usageRecordsSqlite } from "../libs/schema";
import {
  addMeterDefinitionFieldsPostgres,
  addMeterDefinitionFieldsSqlite,
} from "../migrations/addMeterDefinitionFields";
import {
  addUsageEnvelopeFieldsPostgres,
  addUsageEnvelopeFieldsSqlite,
  removeUsageEnvelopeFieldsPostgres,
  removeUsageEnvelopeFieldsSqlite,
} from "../migrations/addUsageEnvelopeFields";
import type { MeteringMigrationClient } from "../migrations/addUsageEnvelopeFields";

const createRepositoryConfig = () => ({
  meterTable: metersSqlite,
  meterSchema: {
    id: metersSqlite.id,
    tenantId: metersSqlite.tenantId,
    meterId: metersSqlite.meterId,
    type: metersSqlite.type,
    billing: metersSqlite.billing,
    aggregation: metersSqlite.aggregation,
    unit: metersSqlite.unit,
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
    eventId: usageRecordsSqlite.eventId,
    dimensions: usageRecordsSqlite.dimensions,
  },
});

const createLegacyRepositoryConfig = () => ({
  ...createRepositoryConfig(),
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
  db: DrizzleMeterDatabase,
  observe: (operation: DrizzleOperationName) => void,
): DrizzleMeterDatabase {
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
  }) as DrizzleMeterDatabase;
}

function createSqliteTransactionHarness(sqlite: Database.Database, db: DrizzleMeterDatabase) {
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
  } as unknown as TxManager<DrizzleMeterDatabase>;
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
  let db!: DrizzleMeterDatabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txManager!: TxManager<any, any>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite);

    sqlite.exec(`
      CREATE TABLE meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        meter_id TEXT NOT NULL,
        type TEXT NOT NULL,
        billing TEXT NOT NULL DEFAULT 'local',
        aggregation TEXT,
        unit TEXT,
        quota INTEGER,
        allow_over_quota INTEGER NOT NULL DEFAULT 0,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    sqlite.exec(`
      CREATE UNIQUE INDEX meters_tenant_meter_unique ON meters (tenant_id, meter_id)
    `);

    sqlite.exec(`
      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        meter_id TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 1,
        recorded_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        idempotency_key TEXT,
        event_id TEXT,
        dimensions TEXT
      )
    `);

    sqlite.exec(`
      CREATE UNIQUE INDEX usage_records_idempotency_unique
        ON usage_records (tenant_id, meter_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);
    sqlite.exec(`
      CREATE INDEX usage_records_event_id_idx
        ON usage_records (tenant_id, event_id)
        WHERE event_id IS NOT NULL
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
                    expect.objectContaining({ name: "event_id" }),
                    expect.objectContaining({ name: "dimensions" }),
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
                    expect.objectContaining({
                      name: "usage_records_event_id_idx",
                      unique: 0,
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
    it("should accept a SQLite client without a database cast", () => {
      expectTypeOf<
        BetterSQLite3Database<Record<string, never>>
      >().toMatchTypeOf<DrizzleMeterDatabase>();
    });

    it("should accept a Node PostgreSQL client without a SQLite cast", () => {
      expectTypeOf<NodePgDatabase<Record<string, never>>>().toMatchTypeOf<DrizzleMeterDatabase>();

      const createPostgresRepository = (
        pgDb: NodePgDatabase<Record<string, never>>,
      ): DrizzleMeterRepository => {
        const pgTxManager = new TxManager(createDrizzleTxAdapter(pgDb), {
          defaultNesting: "join",
        });

        return new DrizzleMeterRepository(pgDb, pgTxManager, {
          meterTable: metersPg,
          meterSchema: metersPg,
          usageRecordTable: usageRecordsPg,
          usageRecordSchema: usageRecordsPg,
        });
      };

      expectTypeOf(createPostgresRepository).returns.toEqualTypeOf<DrizzleMeterRepository>();
    });

    it("should encode PostgreSQL meter timestamps as dates", async () => {
      const onConflictDoUpdate = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "3d3ff6c3-09a3-4b12-9896-536f58c92cb5",
            tenantId: "tenant-pg",
            meterId: "api_calls",
            type: "COUNT",
            billing: "local",
            aggregation: null,
            unit: null,
            quota: null,
            allowOverQuota: 0,
            metadata: {},
            createdAt: new Date("2026-09-17T00:00:00.000Z"),
            updatedAt: new Date("2026-09-17T00:00:00.000Z"),
          },
        ]),
      });
      const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
      const pgDb = {
        insert: vi.fn().mockReturnValue({ values }),
      } as unknown as DrizzleMeterDatabase;
      const pgTxManager = {
        getClient: () => undefined,
      } as unknown as TxManager<DrizzleMeterDatabase>;
      const pgRepository = new DrizzleMeterRepository(pgDb, pgTxManager, {
        meterTable: metersPg,
        meterSchema: metersPg,
        usageRecordTable: usageRecordsPg,
        usageRecordSchema: usageRecordsPg,
      });

      await pgRepository.save({
        tenantId: "tenant-pg",
        meterId: "api_calls",
        type: "COUNT",
      });

      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Date),
          metadata: {},
          updatedAt: expect.any(Date),
        }),
      );
      expect(onConflictDoUpdate).toHaveBeenCalledWith({
        target: [metersPg.tenantId, metersPg.meterId],
        set: {
          type: "COUNT",
          billing: "local",
          aggregation: null,
          unit: null,
          quota: null,
          allowOverQuota: 0,
          metadata: {},
          updatedAt: expect.any(Date),
        },
      });
    });

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

    it("should preserve a zero quota", async () => {
      const meter = await repository.save({
        tenantId: "tenant-1",
        meterId: "disabled-meter",
        type: "COUNT",
        quota: 0,
      });

      expect(meter.quota).toBe(0);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      "should reject invalid quota %s before writing the meter",
      async (quota) => {
        await expect(
          repository.save({
            tenantId: "tenant-1",
            meterId: "invalid-quota",
            type: "COUNT",
            quota,
          }),
        ).rejects.toThrow(InvalidUsageValueProblem);

        expect(
          sqlite.prepare("SELECT * FROM meters WHERE meter_id = ?").all("invalid-quota"),
        ).toHaveLength(0);
      },
    );

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

    it("should reject an unsafe stored quota", async () => {
      sqlite
        .prepare(
          `INSERT INTO meters (tenant_id, meter_id, type, quota, allow_over_quota, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "tenant-1",
          "unsafe-quota",
          "COUNT",
          BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
          0,
          "{}",
          Date.now(),
          Date.now(),
        );

      await expect(repository.findByMeterIdAndTenant("unsafe-quota", "tenant-1")).rejects.toThrow(
        InvalidUsageValueProblem,
      );
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await repository.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
      });
      await repository.save({
        tenantId: "tenant-1",
        meterId: "storage",
        type: "COUNT",
      });
      await repository.save({
        tenantId: "tenant-2",
        meterId: "api_calls",
        type: "COUNT",
      });
    });

    it("should return all meters", async () => {
      const meters = await repository.findAll();

      expect(meters).toHaveLength(3);
    });

    it("should return empty array when no meters", async () => {
      const sqlite2 = new Database(":memory:");
      const db2: DrizzleMeterDatabase = drizzle(sqlite2);
      sqlite2.exec(`
        CREATE TABLE meters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL,
          meter_id TEXT NOT NULL,
          type TEXT NOT NULL,
          billing TEXT NOT NULL DEFAULT 'local',
          aggregation TEXT,
          unit TEXT,
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
      await repository.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
      });
      await repository.save({
        tenantId: "tenant-1",
        meterId: "storage",
        type: "COUNT",
      });
      await repository.save({
        tenantId: "tenant-2",
        meterId: "api_calls",
        type: "COUNT",
      });
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

  describe("meter billing contract", () => {
    const persistentJournal = { durability: "persistent" } as BillableUsageJournal;

    it("should round-trip billing, aggregation, and unit through every lookup", async () => {
      const saved = await repository.save({
        tenantId: "tenant-1",
        meterId: "llm-tokens",
        type: "CUSTOM_EVENT",
        billing: "required",
        aggregation: "SUM",
        unit: "token",
      });

      const contract = { billing: "required", aggregation: "SUM", unit: "token" };
      expect(saved).toMatchObject(contract);
      expect(await repository.findByMeterIdAndTenant("llm-tokens", "tenant-1")).toMatchObject(
        contract,
      );
      expect(await repository.findByTenant("tenant-1")).toEqual([
        expect.objectContaining(contract),
      ]);
      expect(await repository.findAll()).toEqual([expect.objectContaining(contract)]);
    });

    it("should store local billing without aggregation or unit when they are omitted", async () => {
      const saved = await repository.save({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
      });

      expect(saved.billing).toBe("local");
      expect(saved.aggregation).toBeUndefined();
      expect(saved.unit).toBeUndefined();
      expect(sqlite.prepare("SELECT billing, aggregation, unit FROM meters").all()).toEqual([
        { billing: "local", aggregation: null, unit: null },
      ]);
    });

    it("should keep billing-required meters required after registration and restart", async () => {
      const registry = new MeterRegistry(repository, 60_000, persistentJournal);

      await registry.register({
        tenantId: "t2",
        meterId: "llm-tokens",
        type: "CUSTOM_EVENT",
        billing: "required",
        aggregation: "SUM",
        unit: "token",
      });
      expect(registry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");

      registry.clearCache();
      await registry.loadAll();
      expect(registry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");

      const restartedRegistry = new MeterRegistry(repository, 60_000, persistentJournal);
      await restartedRegistry.loadAll();
      expect(restartedRegistry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");
      expect(await restartedRegistry.get("t2", "llm-tokens")).toMatchObject({
        aggregation: "SUM",
        unit: "token",
      });
    });

    it("should replace the single stored definition when a meter is registered again", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
        const first = await repository.save({
          tenantId: "t1",
          meterId: "ai-tokens",
          type: "COUNT",
          aggregation: "COUNT",
          unit: "request",
          quota: 1000,
          allowOverQuota: true,
          metadata: { plan: "starter" },
        });

        vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));
        const second = await repository.save({
          tenantId: "t1",
          meterId: "ai-tokens",
          type: "CUSTOM_EVENT",
          billing: "required",
          aggregation: "SUM",
          unit: "token",
          quota: 5000,
        });

        const expected = {
          id: first.id,
          tenantId: "t1",
          meterId: "ai-tokens",
          type: "CUSTOM_EVENT",
          billing: "required",
          aggregation: "SUM",
          unit: "token",
          quota: 5000,
          allowOverQuota: false,
          metadata: undefined,
          createdAt: new Date("2026-09-01T00:00:00.000Z"),
          updatedAt: new Date("2026-09-02T00:00:00.000Z"),
        };
        expect(second).toEqual(expected);
        expect(await repository.findByMeterIdAndTenant("ai-tokens", "t1")).toEqual(expected);
        expect(
          sqlite
            .prepare("SELECT quota FROM meters WHERE tenant_id = ? AND meter_id = ?")
            .all("t1", "ai-tokens"),
        ).toEqual([{ quota: 5000 }]);

        const third = await repository.save({
          tenantId: "t1",
          meterId: "ai-tokens",
          type: "COUNT",
        });
        expect(third).toMatchObject({
          id: first.id,
          billing: "local",
          aggregation: undefined,
          unit: undefined,
          quota: undefined,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("should keep one definition per tenant when registration repeats at every startup", async () => {
      const registration = {
        tenantId: "t1",
        meterId: "ai-tokens",
        type: "COUNT" as const,
        quota: 1000,
      };

      await new MeterRegistry(repository).register(registration);
      await new MeterRegistry(repository).register({ ...registration, quota: 5000 });
      await new MeterRegistry(repository).register({ ...registration, tenantId: "t2" });

      expect(await repository.findByTenant("t1")).toEqual([
        expect.objectContaining({ meterId: "ai-tokens", quota: 5000 }),
      ]);
      expect(await repository.findAll()).toHaveLength(2);
    });

    it.each([
      ["billing", "remote", "remote"],
      ["aggregation", "AVERAGE", "AVERAGE"],
      ["unit", Buffer.from("token"), "token"],
    ] as const)(
      "should reject a stored %s value outside the meter contract",
      async (field, storedValue, receivedValue) => {
        sqlite
          .prepare(
            `INSERT INTO meters (tenant_id, meter_id, type, ${field}, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run("tenant-1", "corrupt-meter", "COUNT", storedValue, Date.now(), Date.now());

        await expect(
          repository.findByMeterIdAndTenant("corrupt-meter", "tenant-1"),
        ).rejects.toMatchObject({
          code: "metering-drizzle/invalid-meter-definition",
          extensions: { tenantId: "tenant-1", meterId: "corrupt-meter", field, receivedValue },
        });
        await expect(repository.findAll()).rejects.toThrow(InvalidMeterDefinitionProblem);
      },
    );

    it.each([
      ["billing", "billing", { billing: "remote" }],
      ["null billing", "billing", { billing: null }],
      ["aggregation", "aggregation", { aggregation: "AVERAGE" }],
      ["unit", "unit", { unit: 42 }],
    ] as const)(
      "should reject an unsupported %s before writing the meter",
      async (_case, field, contract) => {
        await expect(
          repository.save({
            tenantId: "tenant-1",
            meterId: "invalid-contract",
            type: "COUNT",
            ...contract,
          } as unknown as MeterRegistrationOptions),
        ).rejects.toMatchObject({
          code: "metering-drizzle/invalid-meter-definition",
          extensions: { field },
        });

        expect(sqlite.prepare("SELECT * FROM meters").all()).toHaveLength(0);
      },
    );
  });

  describe("meter definition migrations", () => {
    const createLegacyMetersTable = () => {
      sqlite.exec("DROP TABLE meters");
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
    };
    const insertLegacyMeter = (tenantId: string, meterId: string, quota: number) => {
      sqlite
        .prepare(
          `INSERT INTO meters (tenant_id, meter_id, type, quota, created_at, updated_at)
           VALUES (?, ?, 'COUNT', ?, ?, ?)`,
        )
        .run(tenantId, meterId, quota, Date.now(), Date.now());
    };
    const listMeterColumns = () =>
      (sqlite.prepare("PRAGMA table_info('meters')").all() as Array<{ name: string }>).map(
        (column) => column.name,
      );
    const listMeterIndexes = () =>
      sqlite.prepare("PRAGMA index_list('meters')").all() as Array<{
        name: string;
        unique: number;
      }>;
    const renderPostgres = (queries: readonly SQL[]) =>
      queries.map((query) => new PgDialect().sqlToQuery(query).sql.replace(/\s+/g, " ").trim());

    it("should declare the unique index that the migrations create", () => {
      const migratedIndex = {
        name: "meters_tenant_meter_unique",
        unique: true,
        columns: ["tenant_id", "meter_id"],
      };
      const describeIndexes = (
        indexes: readonly {
          config: { name?: string; unique: boolean; columns: readonly unknown[] };
        }[],
      ) =>
        indexes.map(({ config }) => ({
          name: config.name,
          unique: config.unique,
          columns: config.columns.map((column) => (column as { name: string }).name),
        }));

      expect(describeIndexes(getPgTableConfig(metersPg).indexes)).toEqual([migratedIndex]);
      expect(describeIndexes(getSqliteTableConfig(metersSqlite).indexes)).toEqual([migratedIndex]);
    });

    it("should upgrade a legacy SQLite meters table so re-registration updates one row", async () => {
      createLegacyMetersTable();
      insertLegacyMeter("t1", "ai-tokens", 1000);
      const migrationClient = createSqliteMigrationClient();

      await addMeterDefinitionFieldsSqlite(migrationClient);
      await addMeterDefinitionFieldsSqlite(migrationClient);

      expect(listMeterColumns()).toEqual(
        expect.arrayContaining(["billing", "aggregation", "unit"]),
      );
      expect(listMeterIndexes()).toEqual([
        expect.objectContaining({ name: "meters_tenant_meter_unique", unique: 1 }),
      ]);
      expect(await repository.findByMeterIdAndTenant("ai-tokens", "t1")).toMatchObject({
        billing: "local",
        aggregation: undefined,
        unit: undefined,
        quota: 1000,
      });

      await repository.save({
        tenantId: "t1",
        meterId: "ai-tokens",
        type: "CUSTOM_EVENT",
        billing: "required",
        aggregation: "SUM",
        unit: "token",
        quota: 5000,
      });
      expect(await repository.findByTenant("t1")).toEqual([
        expect.objectContaining({ billing: "required", aggregation: "SUM", quota: 5000 }),
      ]);
    });

    it("should report duplicate SQLite meter definitions without changing the table", async () => {
      createLegacyMetersTable();
      insertLegacyMeter("t2", "storage", 1);
      insertLegacyMeter("t1", "ai-tokens", 1000);
      insertLegacyMeter("t2", "ai-tokens", 1000);
      insertLegacyMeter("t1", "ai-tokens", 5000);
      insertLegacyMeter("t2", "storage", 2);
      insertLegacyMeter("t2", "storage", 3);
      const legacyColumns = listMeterColumns();

      const error = await addMeterDefinitionFieldsSqlite(createSqliteMigrationClient()).then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(DuplicateMeterDefinitionsProblem);
      expect(error).toMatchObject({
        code: "metering-drizzle/duplicate-meter-definitions",
        detail:
          "Cannot enforce unique meter definitions because duplicates exist: tenant 't1', meter 'ai-tokens' (2 rows); tenant 't2', meter 'storage' (3 rows)",
        extensions: {
          duplicates: [
            { tenantId: "t1", meterId: "ai-tokens", rowCount: 2 },
            { tenantId: "t2", meterId: "storage", rowCount: 3 },
          ],
        },
      });
      expect(listMeterColumns()).toEqual(legacyColumns);
      expect(listMeterIndexes()).toEqual([]);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM meters").get()).toEqual({ count: 6 });
    });

    it.each([
      [20, ""],
      [23, "; 3 more in extensions.duplicates"],
    ])(
      "should bound the duplicate detail for %i duplicates while keeping all of them in extensions",
      (count, suffix) => {
        const duplicates = Array.from({ length: count }, (_, index) => ({
          tenantId: `t${String(index).padStart(2, "0")}`,
          meterId: "ai-tokens",
          rowCount: 2,
        }));

        const problem = new DuplicateMeterDefinitionsProblem(duplicates);

        const listed = duplicates
          .slice(0, 20)
          .map((duplicate) => `tenant '${duplicate.tenantId}', meter 'ai-tokens' (2 rows)`)
          .join("; ");
        expect(problem.detail).toBe(
          `Cannot enforce unique meter definitions because duplicates exist: ${listed}${suffix}`,
        );
        expect(problem.extensions).toEqual({ duplicates });
      },
    );

    it("should expose PostgreSQL meter definition upgrade statements", async () => {
      const queries: SQL[] = [];

      await addMeterDefinitionFieldsPostgres({
        async execute(query) {
          queries.push(query as SQL);
          return { rows: [] };
        },
      });

      expect(renderPostgres(queries)).toEqual([
        "ALTER TABLE meters ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'local'",
        "ALTER TABLE meters ADD COLUMN IF NOT EXISTS aggregation TEXT",
        "ALTER TABLE meters ADD COLUMN IF NOT EXISTS unit TEXT",
        "SELECT tenant_id, meter_id, CAST(COUNT(*) AS INTEGER) AS row_count FROM meters GROUP BY tenant_id, meter_id HAVING COUNT(*) > 1 ORDER BY tenant_id, meter_id",
        "CREATE UNIQUE INDEX IF NOT EXISTS meters_tenant_meter_unique ON meters (tenant_id, meter_id)",
      ]);
    });

    it.each([
      ["a non-row result", undefined],
      ["an uncast duplicate count", { rows: [{ tenant_id: "t1", meter_id: "m", row_count: "2" }] }],
    ])(
      "should reject %s from the duplicate check before creating the index",
      async (_case, duplicateResult) => {
        const queries: SQL[] = [];
        const migration = addMeterDefinitionFieldsPostgres({
          async execute(query) {
            queries.push(query as SQL);
            return renderPostgres([query as SQL])[0]?.startsWith("SELECT")
              ? duplicateResult
              : undefined;
          },
        });

        await expect(migration).rejects.toMatchObject({
          code: "metering-drizzle/migration-query-result-unsupported",
        });
        expect(renderPostgres(queries).some((query) => query.startsWith("CREATE"))).toBe(false);
      },
    );
  });

  describe("UsageAggregator replay", () => {
    const createRecord = (key: string, value: number): UsageRecord => ({
      id: `record-${key}`,
      tenantId: "tenant-1",
      meterId: "api_calls",
      value,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      idempotencyKey: key,
    });

    const createStorage = (
      records: UsageRecord[],
    ): UsageStorage & Required<Pick<UsageStorage, "deleteUsageRecords">> => ({
      replayContract: "idempotent",
      record: vi.fn(),
      getUsage: vi.fn(),
      isIdempotent: vi.fn(),
      fetchUsageRecords: vi.fn(async () => [...records]),
      deleteUsageRecords: vi.fn(async (_options, persisted: UsageRecord[]) => {
        const ids = new Set(persisted.map((record) => record.id));
        for (let index = records.length - 1; index >= 0; index--) {
          if (ids.has(records[index].id)) records.splice(index, 1);
        }
      }),
      checkAndRecordWithinQuota: vi.fn(),
    });

    it("retries a committed batch after deletion fails with a recreated aggregator", async () => {
      const records = [createRecord("first", 2), createRecord("second", 3)];
      const usageStorage = createStorage(records);
      const deletionFailure = ProblemFactory.internalServerError(
        "testing/usage-delete-failed",
        "usage deletion failed",
      );
      vi.mocked(usageStorage.deleteUsageRecords).mockRejectedValueOnce(deletionFailure);
      const aggregator = new UsageAggregator({ usageStorage, meterRepository: repository });

      await expect(aggregator.flushUsageToDB("tenant-1", "api_calls")).rejects.toBe(
        deletionFailure,
      );
      expect(records).toHaveLength(2);
      expect(
        sqlite.prepare("SELECT COUNT(*) AS count, SUM(value) AS total FROM usage_records").get(),
      ).toEqual({ count: 2, total: 5 });

      const recreated = new UsageAggregator({
        usageStorage,
        meterRepository: new DrizzleMeterRepository(db, txManager, createRepositoryConfig()),
      });
      await expect(recreated.flushUsageToDB("tenant-1", "api_calls")).resolves.toEqual({
        recordsFlushed: 2,
      });
      expect(records).toEqual([]);
      expect(
        sqlite.prepare("SELECT COUNT(*) AS count, SUM(value) AS total FROM usage_records").get(),
      ).toEqual({ count: 2, total: 5 });
    });

    it("deduplicates overlapping concurrent flush batches by logical usage identity", async () => {
      const shared = createRecord("shared", 3);
      const firstStorage = createStorage([createRecord("first", 2), shared]);
      const secondStorage = createStorage([
        { ...shared, id: "replayed-shared-record" },
        createRecord("second", 5),
      ]);
      const first = new UsageAggregator({
        usageStorage: firstStorage,
        meterRepository: repository,
      });
      const second = new UsageAggregator({
        usageStorage: secondStorage,
        meterRepository: new DrizzleMeterRepository(db, txManager, createRepositoryConfig()),
      });

      await expect(
        Promise.all([
          first.flushUsageToDB("tenant-1", "api_calls"),
          second.flushUsageToDB("tenant-1", "api_calls"),
        ]),
      ).resolves.toEqual([{ recordsFlushed: 2 }, { recordsFlushed: 2 }]);
      expect(
        sqlite.prepare("SELECT COUNT(*) AS count, SUM(value) AS total FROM usage_records").get(),
      ).toEqual({ count: 3, total: 10 });
      await expect(first.flushUsageToDB("tenant-1", "api_calls")).resolves.toEqual({
        recordsFlushed: 0,
      });
      await expect(second.flushUsageToDB("tenant-1", "api_calls")).resolves.toEqual({
        recordsFlushed: 0,
      });
    });
  });

  describe("saveUsageRecords", () => {
    it("should preserve usage identity and date values with the PostgreSQL schema", async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      const pgDb = drizzlePostgres({ client: { query } as never });
      const pgTxManager = new TxManager(createDrizzleTxAdapter(pgDb), {
        defaultNesting: "join",
      });
      const pgRepository = new DrizzleMeterRepository(pgDb, pgTxManager, {
        meterTable: metersPg,
        meterSchema: metersPg,
        usageRecordTable: usageRecordsPg,
        usageRecordSchema: usageRecordsPg,
      });
      const timestamp = new Date("2026-09-17T12:34:56.789Z");

      await pgRepository.saveUsageRecords([
        {
          id: "01K5CQ9AG7J7C3Q1M7QSV41N4T",
          tenantId: "tenant-pg",
          meterId: "api_calls",
          value: 3,
          timestamp,
          idempotencyKey: "request-pg",
          metadata: { route: "/usage" },
        },
      ]);

      expect(query).toHaveBeenCalledTimes(1);
      const [queryConfig, parameters] = query.mock.calls[0] as unknown as [
        { text: string },
        unknown[],
      ];
      expect(queryConfig.text).toContain('insert into "usage_records"');
      expect(queryConfig.text).toContain(
        'on conflict ("tenant_id","meter_id","idempotency_key") where "usage_records"."idempotency_key" IS NOT NULL do nothing',
      );
      expect(parameters).toEqual(
        expect.arrayContaining([
          "01K5CQ9AG7J7C3Q1M7QSV41N4T",
          timestamp.toISOString(),
          '{"route":"/usage"}',
        ]),
      );
    });

    it("should apply PostgreSQL casing to the idempotency conflict predicate", async () => {
      const casedUsageRecords = pgTable("cased_usage_records", {
        id: text().primaryKey(),
        tenantId: text().notNull(),
        meterId: text().notNull(),
        value: bigint({ mode: "number" }).notNull(),
        recordedAt: timestamp().notNull(),
        metadata: jsonb().notNull(),
        idempotencyKey: text(),
      });
      const query = vi.fn().mockResolvedValue({ rows: [] });
      const pgDb = drizzlePostgres({ client: { query } as never, casing: "snake_case" });
      const pgRepository = new DrizzleMeterRepository(
        pgDb,
        new TxManager(createDrizzleTxAdapter(pgDb)),
        {
          meterTable: metersPg,
          meterSchema: metersPg,
          usageRecordTable: casedUsageRecords,
          usageRecordSchema: casedUsageRecords,
        },
      );

      await pgRepository.saveUsageRecords([
        {
          id: "usage-cased",
          tenantId: "tenant-cased",
          meterId: "api_calls",
          value: 1,
          timestamp: new Date("2026-09-19T00:00:00.000Z"),
          idempotencyKey: "request-cased",
        },
      ]);

      const [queryConfig] = query.mock.calls[0] as unknown as [{ text: string }];
      expect(queryConfig.text).toContain(
        'on conflict ("tenant_id","meter_id","idempotency_key") where "cased_usage_records"."idempotency_key" IS NOT NULL do nothing',
      );
    });

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

    it("should preserve billing identity and dimensions separately from metadata", async () => {
      await repository.saveUsageRecords([
        {
          id: "record-billable",
          tenantId: "tenant-1",
          meterId: "ai.tokens",
          value: 42,
          timestamp: new Date(),
          idempotencyKey: "request-1",
          eventId: "request-1",
          dimensions: { model: "gpt-5" },
          metadata: { route: "/generate" },
        },
      ]);

      const [result] = sqlite
        .prepare(
          "SELECT event_id, dimensions, metadata FROM usage_records WHERE idempotency_key = ?",
        )
        .all("request-1") as Array<{
        event_id: string;
        dimensions: string;
        metadata: string;
      }>;

      expect(result.event_id).toBe("request-1");
      expect(JSON.parse(result.dimensions)).toEqual({ model: "gpt-5" });
      expect(JSON.parse(result.metadata)).toEqual({ route: "/generate" });
    });

    it.each([0.1, 1.9, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      "should reject invalid usage value %s before writing any batch record",
      async (value) => {
        const request = repository.saveUsageRecords([
          {
            id: "valid-record",
            tenantId: "tenant-1",
            meterId: "api_calls",
            value: 1,
            timestamp: new Date(),
            idempotencyKey: "valid-idem",
          },
          {
            id: "invalid-record",
            tenantId: "tenant-1",
            meterId: "api_calls",
            value,
            timestamp: new Date(),
            idempotencyKey: "invalid-idem",
          },
        ]);
        await expect(request).rejects.toThrow(InvalidUsageValueProblem);
        await expect(request).rejects.toMatchObject({ code: "metering/invalid-usage-value" });

        expect(sqlite.prepare("SELECT * FROM usage_records").all()).toHaveLength(0);
      },
    );

    it.each([
      "GelJson",
      "MySqlJson",
      "PgJson",
      "PgJsonb",
      "SingleStoreJson",
      "SQLiteBlobJson",
      "SQLiteTextJson",
    ])("should preserve %s envelope fields as structured values", async (columnType) => {
      const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
      const values = vi.fn().mockReturnValue({ onConflictDoNothing });
      const pgDb = {
        insert: vi.fn().mockReturnValue({ values }),
      } as unknown as DrizzleMeterDatabase;
      const pgTxManager = {
        getClient: () => undefined,
      } as unknown as TxManager<DrizzleMeterDatabase>;
      const usageRecordSchema = {
        ...usageRecordsPg,
        metadata: { columnType },
        dimensions: { columnType },
      };
      const pgRepository = new DrizzleMeterRepository(pgDb, pgTxManager, {
        meterTable: metersPg,
        meterSchema: metersPg,
        usageRecordTable: usageRecordsPg,
        usageRecordSchema,
      } as unknown as DrizzleMeterRepositoryConfig);

      await pgRepository.saveUsageRecords([
        {
          id: "record-billable",
          tenantId: "tenant-1",
          meterId: "ai.tokens",
          value: 42,
          timestamp: new Date(),
          idempotencyKey: "request-1",
          eventId: "request-1",
          dimensions: { model: "gpt-5" },
          metadata: { route: "/generate" },
        },
      ]);

      expect(values).toHaveBeenCalledWith([
        expect.objectContaining({
          dimensions: { model: "gpt-5" },
          metadata: { route: "/generate" },
        }),
      ]);
    });

    it("should reject typed usage when legacy configuration omits envelope mappings", async () => {
      const legacyRepository = new DrizzleMeterRepository(
        db,
        txManager,
        createLegacyRepositoryConfig(),
      );

      await expect(
        legacyRepository.saveUsageRecords([
          {
            id: "record-billable",
            tenantId: "tenant-1",
            meterId: "ai.tokens",
            value: 42,
            timestamp: new Date(),
            idempotencyKey: "request-1",
            eventId: "request-1",
            dimensions: { model: "gpt-5" },
          },
        ]),
      ).rejects.toMatchObject({
        code: "metering-drizzle/usage-envelope-not-configured",
        extensions: { missingMappings: ["eventId", "dimensions"] },
      });

      expect(sqlite.prepare("SELECT * FROM usage_records").all()).toHaveLength(0);
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

  const createSqliteMigrationClient = (failOnDimensions = false) => {
    const dialect = new SQLiteSyncDialect();
    let transactionTail = Promise.resolve();
    const execute = async (query: unknown): Promise<unknown> => {
      const rendered = dialect.sqlToQuery(query as SQL);
      if (failOnDimensions && rendered.sql.includes("ADD COLUMN dimensions")) {
        throw new Error("simulated migration failure");
      }
      const statement = sqlite.prepare(rendered.sql);
      return statement.reader
        ? statement.all(...rendered.params)
        : statement.run(...rendered.params);
    };

    return {
      execute,
      async transaction<T>(
        fn: (tx: { execute(query: unknown): Promise<unknown> }) => Promise<T>,
      ): Promise<T> {
        const previousTransaction = transactionTail;
        let releaseTransaction = () => {};
        transactionTail = new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
        await previousTransaction;
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn({ execute });
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        } finally {
          releaseTransaction();
        }
      },
    };
  };

  describe("usage envelope migrations", () => {
    it("should upgrade an existing SQLite usage table before typed writes", async () => {
      sqlite.exec("DROP TABLE usage_records");
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
      const migrationClient = createSqliteMigrationClient();

      await Promise.all([
        addUsageEnvelopeFieldsSqlite(migrationClient),
        addUsageEnvelopeFieldsSqlite(migrationClient),
      ]);
      await repository.saveUsageRecords([
        {
          id: "record-billable",
          tenantId: "tenant-1",
          meterId: "ai.tokens",
          value: 42,
          timestamp: new Date(),
          idempotencyKey: "request-1",
          eventId: "request-1",
          dimensions: { model: "gpt-5" },
        },
      ]);

      const columns = sqlite.prepare("PRAGMA table_info('usage_records')").all() as Array<{
        name: string;
      }>;
      const [record] = sqlite
        .prepare("SELECT event_id, dimensions FROM usage_records")
        .all() as Array<{ event_id: string; dimensions: string }>;

      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["event_id", "dimensions"]),
      );
      expect(
        (
          sqlite.prepare("PRAGMA index_list('usage_records')").all() as Array<{
            name: string;
          }>
        ).map((index) => index.name),
      ).toContain("usage_records_event_id_idx");
      expect(record.event_id).toBe("request-1");
      expect(JSON.parse(record.dimensions)).toEqual({ model: "gpt-5" });
    });

    it("should rerun SQLite removal safely and roll back partial upgrades", async () => {
      const migrationClient = createSqliteMigrationClient();

      await removeUsageEnvelopeFieldsSqlite(migrationClient);
      await removeUsageEnvelopeFieldsSqlite(migrationClient);
      expect(
        (
          sqlite.prepare("PRAGMA table_info('usage_records')").all() as Array<{
            name: string;
          }>
        ).map((column) => column.name),
      ).not.toEqual(expect.arrayContaining(["event_id", "dimensions"]));

      const failingClient = createSqliteMigrationClient(true);

      await expect(addUsageEnvelopeFieldsSqlite(failingClient)).rejects.toThrow(
        "simulated migration failure",
      );
      expect(
        (
          sqlite.prepare("PRAGMA table_info('usage_records')").all() as Array<{
            name: string;
          }>
        ).map((column) => column.name),
      ).not.toEqual(expect.arrayContaining(["event_id", "dimensions"]));

      await addUsageEnvelopeFieldsSqlite(migrationClient);
      expect(
        (
          sqlite.prepare("PRAGMA table_info('usage_records')").all() as Array<{
            name: string;
          }>
        ).map((column) => column.name),
      ).toEqual(expect.arrayContaining(["event_id", "dimensions"]));
    });

    it("should expose PostgreSQL-specific upgrade statements", async () => {
      const queries: SQL[] = [];

      await addUsageEnvelopeFieldsPostgres({
        async execute(query) {
          queries.push(query as SQL);
        },
      });

      const normalize = (statement: string) => statement.replace(/\s+/g, " ").trim();
      const sqlStatements = queries.map((query) =>
        normalize(new PgDialect().sqlToQuery(query).sql),
      );
      expect(sqlStatements).toEqual([
        "ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS event_id TEXT",
        "ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS dimensions JSONB",
        "CREATE INDEX IF NOT EXISTS usage_records_event_id_idx ON usage_records (tenant_id, event_id) WHERE event_id IS NOT NULL",
      ]);
    });

    it("should run PostgreSQL envelope changes through the provided transaction", async () => {
      const execute = vi.fn().mockResolvedValue(undefined);
      const fallbackExecute = vi.fn().mockResolvedValue(undefined);
      const transaction = vi.fn();
      const migrationClient: MeteringMigrationClient = {
        execute: fallbackExecute,
        async transaction<T>(migrate: (tx: MeteringMigrationClient) => Promise<T>): Promise<T> {
          transaction();
          return migrate({ execute });
        },
      };

      await addUsageEnvelopeFieldsPostgres(migrationClient);
      await removeUsageEnvelopeFieldsPostgres(migrationClient);

      expect(transaction).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenCalledTimes(6);
      expect(fallbackExecute).not.toHaveBeenCalled();
    });
  });

  describe("deserializeMetadata JSON parse failure", () => {
    it("should log warn and return undefined on invalid JSON", async () => {
      const logger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(() => logger),
      };
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
      } as DrizzleMeterDatabase;

      const mockTxManager = {
        getClient: () => txDb,
        run: async (fn: () => Promise<void>) => fn(),
      } as unknown as TxManager<DrizzleMeterDatabase>;

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
