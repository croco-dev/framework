import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { type DrizzleDb, DrizzleMeterRepository } from '../libs/DrizzleMeterRepository';
import { metersSqlite, usageRecordsSqlite } from '../libs/schema';

describe('DrizzleMeterRepository', () => {
  let repository!: DrizzleMeterRepository;
  let sqlite!: Database.Database;
  let db!: DrizzleDb;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txManager!: TxManager<any, any>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
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

    const adapter = createDrizzleTxAdapter(db as unknown as Parameters<typeof createDrizzleTxAdapter>[0]);
    txManager = new TxManager(adapter, { defaultNesting: 'join' });

    const meterSchema = {
      id: metersSqlite.id,
      tenantId: metersSqlite.tenantId,
      meterId: metersSqlite.meterId,
      type: metersSqlite.type,
      quota: metersSqlite.quota,
      allowOverQuota: metersSqlite.allowOverQuota,
      metadata: metersSqlite.metadata,
      createdAt: metersSqlite.createdAt,
      updatedAt: metersSqlite.updatedAt,
    };

    const usageRecordSchema = {
      id: usageRecordsSqlite.id,
      tenantId: usageRecordsSqlite.tenantId,
      meterId: usageRecordsSqlite.meterId,
      value: usageRecordsSqlite.value,
      recordedAt: usageRecordsSqlite.recordedAt,
      metadata: usageRecordsSqlite.metadata,
      idempotencyKey: usageRecordsSqlite.idempotencyKey,
    };

    repository = new DrizzleMeterRepository(db, txManager, {
      meterTable: metersSqlite,
      meterSchema,
      usageRecordTable: usageRecordsSqlite,
      usageRecordSchema,
    });
  });

  describe('save', () => {
    it('should create meter definition', async () => {
      const meter = await repository.save({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        type: 'COUNT',
        quota: 10000,
        allowOverQuota: false,
        metadata: { description: 'API calls per month' },
      });

      expect(meter.id).toBeDefined();
      expect(meter.tenantId).toBe('tenant-1');
      expect(meter.meterId).toBe('api_calls');
      expect(meter.type).toBe('COUNT');
      expect(meter.quota).toBe(10000);
      expect(meter.allowOverQuota).toBe(false);
      expect(meter.metadata).toEqual({ description: 'API calls per month' });
      expect(meter.createdAt).toBeInstanceOf(Date);
      expect(meter.updatedAt).toBeInstanceOf(Date);
    });

    it('should create meter without optional fields', async () => {
      const meter = await repository.save({
        tenantId: 'tenant-1',
        meterId: 'storage_bytes',
        type: 'COUNT',
      });

      expect(meter.id).toBeDefined();
      expect(meter.tenantId).toBe('tenant-1');
      expect(meter.meterId).toBe('storage_bytes');
      expect(meter.type).toBe('COUNT');
      expect(meter.quota).toBeUndefined();
      expect(meter.allowOverQuota).toBe(false);
      expect(meter.metadata).toBeUndefined();
    });

    it('should handle allowOverQuota true', async () => {
      const meter = await repository.save({
        tenantId: 'tenant-1',
        meterId: 'bandwidth',
        type: 'COUNT',
        allowOverQuota: true,
      });

      expect(meter.allowOverQuota).toBe(true);
    });
  });

  describe('findByMeterIdAndTenant', () => {
    beforeEach(async () => {
      await repository.save({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        type: 'COUNT',
        quota: 10000,
      });
    });

    it('should find meter by meterId and tenantId', async () => {
      const meter = await repository.findByMeterIdAndTenant('api_calls', 'tenant-1');

      expect(meter).not.toBeNull();
      expect(meter?.meterId).toBe('api_calls');
      expect(meter?.tenantId).toBe('tenant-1');
      expect(meter?.quota).toBe(10000);
    });

    it('should return null when meter not found', async () => {
      const meter = await repository.findByMeterIdAndTenant('nonexistent', 'tenant-1');

      expect(meter).toBeNull();
    });

    it('should return null when tenant not found', async () => {
      const meter = await repository.findByMeterIdAndTenant('api_calls', 'tenant-nonexistent');

      expect(meter).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await repository.save({ tenantId: 'tenant-1', meterId: 'api_calls', type: 'COUNT' });
      await repository.save({ tenantId: 'tenant-1', meterId: 'storage', type: 'COUNT' });
      await repository.save({ tenantId: 'tenant-2', meterId: 'api_calls', type: 'COUNT' });
    });

    it('should return all meters', async () => {
      const meters = await repository.findAll();

      expect(meters).toHaveLength(3);
    });

    it('should return empty array when no meters', async () => {
      const repo = new DrizzleMeterRepository(db, txManager, {
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

      const sqlite2 = new Database(':memory:');
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

      const emptyRepo = new DrizzleMeterRepository(db2, txManager, {
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

      const meters = await emptyRepo.findAll();
      expect(meters).toHaveLength(0);
    });
  });

  describe('findByTenant', () => {
    beforeEach(async () => {
      await repository.save({ tenantId: 'tenant-1', meterId: 'api_calls', type: 'COUNT' });
      await repository.save({ tenantId: 'tenant-1', meterId: 'storage', type: 'COUNT' });
      await repository.save({ tenantId: 'tenant-2', meterId: 'api_calls', type: 'COUNT' });
    });

    it('should return meters for specific tenant', async () => {
      const meters = await repository.findByTenant('tenant-1');

      expect(meters).toHaveLength(2);
      expect(meters.every((m) => m.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty array when tenant has no meters', async () => {
      const meters = await repository.findByTenant('tenant-nonexistent');

      expect(meters).toHaveLength(0);
    });
  });

  describe('saveUsageRecords', () => {
    it('should save usage records', async () => {
      await repository.saveUsageRecords([
        {
          id: 'record-1',
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 1,
          timestamp: new Date(),
          idempotencyKey: 'idem-1',
          metadata: { endpoint: '/api/users' },
        },
        {
          id: 'record-2',
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 1,
          timestamp: new Date(),
          idempotencyKey: 'idem-2',
          metadata: { endpoint: '/api/orders' },
        },
      ]);

      const result = sqlite.prepare('SELECT * FROM usage_records').all();
      expect(result).toHaveLength(2);
    });

    it('should handle empty array', async () => {
      await repository.saveUsageRecords([]);

      const result = sqlite.prepare('SELECT * FROM usage_records').all();
      expect(result).toHaveLength(0);
    });

    it('should save records without metadata', async () => {
      await repository.saveUsageRecords([
        {
          id: 'record-1',
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 5,
          timestamp: new Date(),
          idempotencyKey: 'idem-1',
        },
      ]);

      const result = sqlite.prepare('SELECT * FROM usage_records').all() as Array<{
        tenant_id: string;
        meter_id: string;
        value: number;
        idempotency_key: string;
      }>;
      expect(result).toHaveLength(1);
      expect(result[0].tenant_id).toBe('tenant-1');
      expect(result[0].meter_id).toBe('api_calls');
      expect(result[0].value).toBe(5);
      expect(result[0].idempotency_key).toBe('idem-1');
    });
  });

  describe('transaction support', () => {
    it('should use getClient when in transaction context', async () => {
      const txDb = {
        insert: db.insert.bind(db),
        select: db.select.bind(db),
      } as DrizzleDb;

      const mockTxManager = {
        getClient: () => txDb,
        run: async (fn: () => Promise<void>) => fn(),
      } as unknown as TxManager<DrizzleDb>;

      const repoWithMockTx = new DrizzleMeterRepository(db, mockTxManager, {
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

      const meter = await repoWithMockTx.save({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        type: 'COUNT',
      });

      expect(meter.id).toBeDefined();

      const found = await repoWithMockTx.findByMeterIdAndTenant('api_calls', 'tenant-1');
      expect(found).not.toBeNull();
    });
  });
});
