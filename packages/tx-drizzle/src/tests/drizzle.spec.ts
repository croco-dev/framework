import type { TxAdapter } from '@croco/tx-core';
import { describe, expect, it, vi } from 'vitest';
import { createDrizzleTxAdapter, createRlsTxAdapter } from '../index';

interface MockTx {
  id: string;
}

interface MockRlsTx extends MockTx {
  execute(query: unknown): Promise<void>;
}

describe('DrizzleTxAdapter', () => {
  function createMockDrizzleDb() {
    const transactionFn = async <T>(fn: (tx: MockTx) => Promise<T>): Promise<T> => {
      const tx: MockTx = { id: 'drizzle-tx' };
      return fn(tx);
    };

    return {
      transaction: vi.fn(transactionFn) as typeof transactionFn,
    };
  }

  it('should create adapter from drizzle db', () => {
    const db = createMockDrizzleDb();
    const adapter = createDrizzleTxAdapter(db);

    expect(adapter).toBeDefined();
    expect(typeof adapter.transaction).toBe('function');
    expect(typeof adapter.savepoint).toBe('function');
    expect(typeof adapter.supportsSavepoint).toBe('function');
  });

  describe('transaction', () => {
    it('should delegate to drizzle db.transaction', async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;

      const result = await adapter.transaction(async (tx) => {
        expect(tx.id).toBe('drizzle-tx');
        return 'result';
      });

      expect(result).toBe('result');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors', async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);

      await expect(
        adapter.transaction(async () => {
          throw new Error('DB error');
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('supportsSavepoint', () => {
    it('should return true', () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);

      expect(adapter.supportsSavepoint()).toBe(true);
    });
  });

  describe('savepoint', () => {
    it('should execute function with client', async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;

      const client: MockTx = { id: 'existing-tx' };
      const result = await adapter.savepoint(client, async (tx) => {
        expect(tx.id).toBe('existing-tx');
        return 'savepoint-result';
      });

      expect(result).toBe('savepoint-result');
    });
  });
});

describe('RlsTxAdapter', () => {
  function createMockRlsDrizzleDb() {
    const execute = vi.fn(async (_query: unknown): Promise<void> => undefined);
    const transactionFn = async <T>(fn: (tx: MockRlsTx) => Promise<T>): Promise<T> => {
      const tx: MockRlsTx = {
        id: 'drizzle-rls-tx',
        execute,
      };

      return fn(tx);
    };

    return {
      execute,
      transaction: vi.fn(transactionFn) as typeof transactionFn,
    };
  }

  describe('transaction', () => {
    it('should throw an error when tenant id is null', async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => null),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider);
      const runQuery = vi.fn(async () => 'result');

      await expect(adapter.transaction(runQuery)).rejects.toThrow('Tenant context is required');
      expect(tenantProvider.getTenantId).toHaveBeenCalledTimes(1);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(db.execute).not.toHaveBeenCalled();
      expect(runQuery).not.toHaveBeenCalled();
    });

    it('should set RLS when tenant id exists', async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => 'tenant-123'),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider);
      const runQuery = vi.fn(async (tx: MockRlsTx) => {
        expect(tx.id).toBe('drizzle-rls-tx');
        return 'result';
      });

      const result = await adapter.transaction(runQuery);

      expect(result).toBe('result');
      expect(tenantProvider.getTenantId).toHaveBeenCalledTimes(1);
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(runQuery).toHaveBeenCalledTimes(1);
    });
  });
});
