import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type TxAdapter, TxManager } from '../index';

function createMockAdapter(options: { supportsSavepoint?: boolean } = {}): TxAdapter<{ id: string }> {
  return {
    transaction: vi.fn(async (fn) => {
      const client = { id: 'tx-client' };
      return fn(client);
    }),
    savepoint: vi.fn(async (client, fn) => {
      return fn(client);
    }),
    supportsSavepoint: () => options.supportsSavepoint ?? true,
  };
}

describe('TxManager', () => {
  let txManager: TxManager<{ id: string }>;
  let mockAdapter: TxAdapter<{ id: string }>;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
  });

  describe('run', () => {
    it('should execute function within transaction', async () => {
      const result = await txManager.run(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should provide client within transaction', async () => {
      await txManager.run(async () => {
        const client = txManager.getClient();
        expect(client).toBeDefined();
        expect(client?.id).toBe('tx-client');
      });
    });

    it('should propagate errors from transaction', async () => {
      await expect(
        txManager.run(async () => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('isInTransaction', () => {
    it('should return false outside transaction', () => {
      expect(txManager.isInTransaction()).toBe(false);
    });

    it('should return true inside transaction', async () => {
      await txManager.run(async () => {
        expect(txManager.isInTransaction()).toBe(true);
      });
    });

    it('should return false after transaction completes', async () => {
      await txManager.run(async () => {});
      expect(txManager.isInTransaction()).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return null outside transaction', () => {
      expect(txManager.getClient()).toBeNull();
    });

    it('should return client inside transaction', async () => {
      await txManager.run(async () => {
        const client = txManager.getClient();
        expect(client).toEqual({ id: 'tx-client' });
      });
    });
  });

  describe('nesting with join strategy', () => {
    it('should reuse existing transaction by default', async () => {
      await txManager.run(async () => {
        await txManager.run(async () => {
          expect(txManager.isInTransaction()).toBe(true);
        });
      });

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('nesting with savepoint strategy', () => {
    it('should create savepoint for nested transaction', async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: 'savepoint' });

      await savepointTxManager.run(async () => {
        await savepointTxManager.run(async () => {
          expect(savepointTxManager.isInTransaction()).toBe(true);
        });
      });

      expect(savepointAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(savepointAdapter.savepoint).toHaveBeenCalledTimes(1);
    });

    it('should fall back to join if savepoint not supported', async () => {
      const noSavepointAdapter = createMockAdapter({ supportsSavepoint: false });
      const noSavepointTxManager = new TxManager(noSavepointAdapter, { defaultNesting: 'savepoint' });

      await noSavepointTxManager.run(async () => {
        await noSavepointTxManager.run(async () => {
          expect(noSavepointTxManager.isInTransaction()).toBe(true);
        });
      });

      expect(noSavepointAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(noSavepointAdapter.savepoint).not.toHaveBeenCalled();
    });
  });

  describe('run with options', () => {
    it('should accept nesting strategy option', async () => {
      await txManager.run(
        async () => {
          await txManager.run(
            async () => {
              expect(txManager.isInTransaction()).toBe(true);
            },
            { nesting: 'join' }
          );
        },
        { nesting: 'join' }
      );

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TxAdapter interface', () => {
  it('should have required methods', () => {
    const adapter = createMockAdapter();

    expect(typeof adapter.transaction).toBe('function');
    expect(typeof adapter.savepoint).toBe('function');
    expect(typeof adapter.supportsSavepoint).toBe('function');
  });
});
