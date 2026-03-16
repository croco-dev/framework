import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AfterCommitHooksProblem } from './problems/TransactionProblems';
import type { TxAdapter } from './TxAdapter';
import { TxManager } from './TxManager';

function createMockAdapter(): TxAdapter<{ id: string }> {
  return {
    async transaction<T>(fn: (client: { id: string }) => Promise<T>): Promise<T> {
      const client = { id: 'mock-client' };
      return fn(client);
    },
    async savepoint<T>(client: { id: string }, fn: (client: { id: string }) => Promise<T>): Promise<T> {
      return fn(client);
    },
    supportsSavepoint(): boolean {
      return true;
    },
  };
}

describe('TxManager.onAfterCommit', () => {
  let txManager: TxManager<{ id: string }>;

  beforeEach(() => {
    txManager = new TxManager(createMockAdapter());
  });

  it('should execute hooks after successful commit', async () => {
    const hookFn = vi.fn();

    await txManager.run(async () => {
      txManager.onAfterCommit(hookFn);
      return 'result';
    });

    expect(hookFn).toHaveBeenCalledTimes(1);
  });

  it('should execute multiple hooks in order', async () => {
    const order: number[] = [];

    await txManager.run(async () => {
      txManager.onAfterCommit(() => {
        order.push(1);
      });
      txManager.onAfterCommit(() => {
        order.push(2);
      });
      txManager.onAfterCommit(() => {
        order.push(3);
      });
      return 'result';
    });

    expect(order).toEqual([1, 2, 3]);
  });

  it('should not execute hooks on rollback', async () => {
    const hookFn = vi.fn();

    await expect(
      txManager.run(async () => {
        txManager.onAfterCommit(hookFn);
        throw new Error('Rollback!');
      })
    ).rejects.toThrow('Rollback!');

    expect(hookFn).not.toHaveBeenCalled();
  });

  it('should share hooks in nested join transactions', async () => {
    const hooks: string[] = [];

    await txManager.run(async () => {
      txManager.onAfterCommit(() => {
        hooks.push('outer');
      });

      await txManager.run(
        async () => {
          txManager.onAfterCommit(() => {
            hooks.push('inner');
          });
        },
        { nesting: 'join' }
      );

      return 'result';
    });

    expect(hooks).toEqual(['outer', 'inner']);
  });

  it('should reject after commit when one or more hooks fail', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hooks: string[] = [];

    const execution = txManager.run(async () => {
      txManager.onAfterCommit(() => {
        hooks.push('first');
      });
      txManager.onAfterCommit(() => {
        throw new Error('Hook error');
      });
      txManager.onAfterCommit(() => {
        hooks.push('third');
      });
      return 'result';
    });

    await expect(execution).rejects.toThrow(AfterCommitHooksProblem);
    expect(hooks).toEqual(['first', 'third']);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    await expect(execution).rejects.toMatchObject({
      code: 'tx-core/after-commit-hooks-failed',
      detail: '1 afterCommit hook(s) failed after transaction commit',
      extensions: {
        committed: true,
        failureCount: 1,
        failures: [{ name: 'Error', message: 'Hook error' }],
      },
    });
    consoleSpy.mockRestore();
  });

  it('should throw when called outside transaction', () => {
    expect(() => txManager.onAfterCommit(() => {})).toThrow();
  });
});
