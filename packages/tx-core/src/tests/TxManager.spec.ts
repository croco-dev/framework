import { Container, TRANSACTION_CONTEXT_TOKEN } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type TxAdapter, TxManager } from '../index';
import { TxManagerRegistry } from '../libs/TxManagerRegistry';

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
  let txManager!: TxManager<{ id: string }>;
  let mockAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
  });

  it('should not overwrite existing transaction context token on new instance', () => {
    const firstManager = txManager;
    const secondManager = new TxManager(createMockAdapter());

    expect(Container.get(TRANSACTION_CONTEXT_TOKEN as never)).toBe(firstManager);
    expect(Container.get(TRANSACTION_CONTEXT_TOKEN as never)).not.toBe(secondManager);
  });

  it('should register a new manager after registry clear removes stale token', () => {
    const firstManager = txManager;

    TxManagerRegistry.clear();

    const secondManager = new TxManager(createMockAdapter());

    expect(Container.get(TRANSACTION_CONTEXT_TOKEN as never)).not.toBe(firstManager);
    expect(Container.get(TRANSACTION_CONTEXT_TOKEN as never)).toBe(secondManager);
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
        expect(client).not.toBeUndefined();
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
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await noSavepointTxManager.run(async () => {
        await noSavepointTxManager.run(async () => {
          expect(noSavepointTxManager.isInTransaction()).toBe(true);
        });
      });

      expect(noSavepointAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(noSavepointAdapter.savepoint).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TxManager] Savepoint nesting requested but adapter does not support savepoint. Falling back to join.'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should discard savepoint hooks when savepoint rolls back', async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: 'savepoint' });
      const rolledBackHook = vi.fn();

      await savepointTxManager.run(async () => {
        await expect(
          savepointTxManager.run(async () => {
            savepointTxManager.onAfterCommit(rolledBackHook);
            throw new Error('savepoint rollback');
          })
        ).rejects.toThrow('savepoint rollback');
      });

      expect(rolledBackHook).not.toHaveBeenCalled();
    });

    it('should discard savepoint hooks when adapter swallows rollback error', async () => {
      const savepointAdapter: TxAdapter<{ id: string }> = {
        transaction: vi.fn(async (fn) => {
          const client = { id: 'tx-client' };
          return fn(client);
        }),
        savepoint: vi.fn(async (client, fn) => {
          try {
            return await fn(client);
          } catch {
            return 'rolled-back';
          }
        }),
        supportsSavepoint: () => true,
      };
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: 'savepoint' });
      const rolledBackHook = vi.fn();

      await savepointTxManager.run(async () => {
        const nestedResult = await savepointTxManager.run(async () => {
          savepointTxManager.onAfterCommit(rolledBackHook);
          throw new Error('savepoint rollback');
        });

        expect(nestedResult).toBe('rolled-back');
      });

      expect(rolledBackHook).not.toHaveBeenCalled();
    });

    it('should execute savepoint hooks after root commit when savepoint succeeds', async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: 'savepoint' });
      const rootHook = vi.fn();
      const savepointHook = vi.fn();

      await savepointTxManager.run(async () => {
        savepointTxManager.onAfterCommit(rootHook);

        await savepointTxManager.run(async () => {
          savepointTxManager.onAfterCommit(savepointHook);
        });
      });

      expect(rootHook).toHaveBeenCalledTimes(1);
      expect(savepointHook).toHaveBeenCalledTimes(1);
    });

    it('should keep transaction context while running afterCommit hooks', async () => {
      const observedClients: Array<{ id: string } | null> = [];

      await txManager.run(async () => {
        txManager.onAfterCommit(async () => {
          observedClients.push(txManager.getClient());
        });
      });

      expect(observedClients).toEqual([{ id: 'tx-client' }]);
      expect(txManager.getClient()).toBeNull();
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
