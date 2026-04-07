import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DrizzleDb } from '../libs/DrizzleAuditLogRepository';
import { DrizzleAuditLogRepository } from '../libs/DrizzleAuditLogRepository';
import { auditLogsSqlite } from '../libs/schema';

describe('DrizzleAuditLogRepository', () => {
  let repository!: DrizzleAuditLogRepository;
  let sqlite!: Database.Database;
  let db!: DrizzleDb;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txManager!: TxManager<any, any>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite) as DrizzleDb;

    sqlite.exec(`
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        diff TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )
    `);

    const adapter = createDrizzleTxAdapter(db as unknown as Parameters<typeof createDrizzleTxAdapter>[0]);
    txManager = new TxManager(adapter, { defaultNesting: 'join' });

    const schema = {
      id: auditLogsSqlite.id,
      tenantId: auditLogsSqlite.tenantId,
      actorId: auditLogsSqlite.actorId,
      action: auditLogsSqlite.action,
      resourceType: auditLogsSqlite.resourceType,
      resourceId: auditLogsSqlite.resourceId,
      payload: auditLogsSqlite.payload,
      diff: auditLogsSqlite.diff,
      metadata: auditLogsSqlite.metadata,
      createdAt: auditLogsSqlite.createdAt,
    };

    repository = new DrizzleAuditLogRepository(db, txManager, {
      table: auditLogsSqlite,
      schema,
    });
  });

  describe('create', () => {
    it('should create audit log entry', async () => {
      const entry = await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.update',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: { email: 'user@example.com' },
        diff: { email: { before: 'old@example.com', after: 'user@example.com' } },
        metadata: { requestId: 'req-1' },
      });

      expect(entry.id).toBeDefined();
      expect(entry.tenantId).toBe('tenant-1');
      expect(entry.actorId).toBe('user-1');
      expect(entry.action).toBe('user.update');
      expect(entry.resourceType).toBe('User');
      expect(entry.resourceId).toBe('user-1');
      expect(entry.payload).toEqual({ email: 'user@example.com' });
      expect(entry.diff).toEqual({ email: { before: 'old@example.com', after: 'user@example.com' } });
      expect(entry.metadata).toEqual({ requestId: 'req-1' });
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should create entry without diff', async () => {
      const entry = await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.view',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: { id: 'user-1' },
        diff: null,
        metadata: {},
      });

      expect(entry.id).toBeDefined();
      expect(entry.diff).toBeNull();
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.create',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-2',
        action: 'user.update',
        resourceType: 'User',
        resourceId: 'user-2',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-2',
        actorId: 'user-3',
        action: 'project.create',
        resourceType: 'Project',
        resourceId: 'project-1',
        payload: {},
        diff: null,
        metadata: {},
      });
    });

    it('should find entries by tenant', async () => {
      const results = await repository.find({ tenantId: 'tenant-1' });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.tenantId === 'tenant-1')).toBe(true);
    });

    it('should find entries by tenant and actor', async () => {
      const results = await repository.find({ tenantId: 'tenant-1', actorId: 'user-1' });

      expect(results).toHaveLength(1);
      expect(results[0].actorId).toBe('user-1');
    });

    it('should find entries by tenant and resource', async () => {
      const results = await repository.find({ tenantId: 'tenant-1', resourceType: 'User' });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.resourceType === 'User')).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const results = await repository.find({ tenantId: 'tenant-1', limit: 1, offset: 0 });

      expect(results).toHaveLength(1);
    });

    it('should return empty array when no matches', async () => {
      const results = await repository.find({ tenantId: 'tenant-nonexistent' });

      expect(results).toHaveLength(0);
    });
  });

  describe('findByDateRange', () => {
    beforeEach(async () => {
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.create',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
    });

    it('should find entries within date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 86400000);
      const endDate = new Date(now.getTime() + 86400000);

      const results = await repository.findByDateRange('tenant-1', startDate, endDate);

      expect(results).toHaveLength(1);
      expect(results[0].tenantId).toBe('tenant-1');
    });

    it('should return empty array when outside date range', async () => {
      const past = new Date('2000-01-01');
      const past2 = new Date('2000-01-02');

      const results = await repository.findByDateRange('tenant-1', past, past2);

      expect(results).toHaveLength(0);
    });
  });

  describe('findByActor', () => {
    beforeEach(async () => {
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.create',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.update',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-2',
        action: 'project.create',
        resourceType: 'Project',
        resourceId: 'project-1',
        payload: {},
        diff: null,
        metadata: {},
      });
    });

    it('should find entries by actor', async () => {
      const results = await repository.findByActor('tenant-1', 'user-1');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.actorId === 'user-1')).toBe(true);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 86400000);
      const endDate = new Date(now.getTime() + 86400000);

      const results = await repository.findByActor('tenant-1', 'user-1', { startDate, endDate });

      expect(results).toHaveLength(2);
    });
  });

  describe('findByResource', () => {
    beforeEach(async () => {
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.create',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-2',
        action: 'user.update',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });
      await repository.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'project.create',
        resourceType: 'Project',
        resourceId: 'project-1',
        payload: {},
        diff: null,
        metadata: {},
      });
    });

    it('should find entries by resource', async () => {
      const results = await repository.findByResource('tenant-1', 'User', 'user-1');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.resourceType === 'User' && r.resourceId === 'user-1')).toBe(true);
    });

    it('should return empty when resource not found', async () => {
      const results = await repository.findByResource('tenant-1', 'User', 'nonexistent');

      expect(results).toHaveLength(0);
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

      const schema = {
        id: auditLogsSqlite.id,
        tenantId: auditLogsSqlite.tenantId,
        actorId: auditLogsSqlite.actorId,
        action: auditLogsSqlite.action,
        resourceType: auditLogsSqlite.resourceType,
        resourceId: auditLogsSqlite.resourceId,
        payload: auditLogsSqlite.payload,
        diff: auditLogsSqlite.diff,
        metadata: auditLogsSqlite.metadata,
        createdAt: auditLogsSqlite.createdAt,
      };

      const repoWithMockTx = new DrizzleAuditLogRepository(db, mockTxManager, {
        table: auditLogsSqlite,
        schema,
      });

      const entry = await repoWithMockTx.create({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'user.create',
        resourceType: 'User',
        resourceId: 'user-1',
        payload: {},
        diff: null,
        metadata: {},
      });

      expect(entry.id).toBeDefined();

      const found = await repoWithMockTx.find({ tenantId: 'tenant-1' });
      expect(found).toHaveLength(1);
    });
  });
});
