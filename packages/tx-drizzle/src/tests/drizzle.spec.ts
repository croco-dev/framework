import type { TxAdapter } from '@croco/tx-core';
import { describe, expect, it, vi } from 'vitest';
import { createDrizzleTxAdapter } from '../index';

interface MockTx {
  id: string;
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
