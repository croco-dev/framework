import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transactional, TransactionTimeoutProblem, type TxAdapter, TxManager, TxManagerRegistry } from '../index';

function createMockAdapter(options: { supportsSavepoint?: boolean; delay?: number } = {}): TxAdapter<{ id: string }> {
  const delay = options.delay ?? 0;
  return {
    transaction: vi.fn(async (fn) => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const client = { id: 'tx-client' };
      return fn(client);
    }),
    savepoint: vi.fn(async (client, fn) => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      return fn(client);
    }),
    supportsSavepoint: () => options.supportsSavepoint ?? true,
  };
}

describe('TxManager Concurrent Tests', () => {
  let txManager!: TxManager<{ id: string }>;
  let mockAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    TxManagerRegistry.clear();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
    TxManagerRegistry.register(txManager);
  });

  describe('concurrent transaction isolation', () => {
    it('should isolate concurrent transactions from each other', async () => {
      const clients: string[] = [];

      const promise1 = txManager.run(async () => {
        const client = txManager.getClient();
        clients.push(`t1:${client?.id ?? 'null'}`);
        await new Promise((r) => setTimeout(r, 50));
        const clientAfterWait = txManager.getClient();
        clients.push(`t1-after:${clientAfterWait?.id ?? 'null'}`);
        return 'result1';
      });

      const promise2 = txManager.run(async () => {
        const client = txManager.getClient();
        clients.push(`t2:${client?.id ?? 'null'}`);
        await new Promise((r) => setTimeout(r, 30));
        const clientAfterWait = txManager.getClient();
        clients.push(`t2-after:${clientAfterWait?.id ?? 'null'}`);
        return 'result2';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(2);
      expect(clients).toHaveLength(4);
    });

    it('should maintain transaction context per async context', async () => {
      const contextChecks: boolean[] = [];

      const promise1 = txManager.run(async () => {
        contextChecks.push(txManager.isInTransaction());
        await new Promise((r) => setTimeout(r, 10));
        contextChecks.push(txManager.isInTransaction());
        return 'done';
      });

      const promise2 = txManager.run(async () => {
        contextChecks.push(txManager.isInTransaction());
        await new Promise((r) => setTimeout(r, 5));
        contextChecks.push(txManager.isInTransaction());
        return 'done';
      });

      await Promise.all([promise1, promise2]);

      expect(contextChecks).toEqual([true, true, true, true]);
    });

    it('should handle race condition between transaction start and check', async () => {
      const results: (boolean | null)[] = [];

      const promises = Array.from({ length: 10 }, (_, i) =>
        txManager.run(async () => {
          results.push(txManager.isInTransaction());
          await new Promise((r) => setTimeout(r, Math.random() * 20));
          results.push(txManager.getClient() !== null);
          return i;
        })
      );

      await Promise.all(promises);

      expect(results.every((r) => r === true)).toBe(true);
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(10);
    });
  });

  describe('concurrent afterCommit hooks', () => {
    it('should execute afterCommit hooks sequentially in each transaction', async () => {
      const executionOrder: string[] = [];

      await txManager.run(async () => {
        txManager.onAfterCommit(async () => {
          executionOrder.push('hook1-start');
          await new Promise((r) => setTimeout(r, 30));
          executionOrder.push('hook1-end');
        });
        txManager.onAfterCommit(async () => {
          executionOrder.push('hook2-start');
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push('hook2-end');
        });
      });

      expect(executionOrder).toEqual(['hook1-start', 'hook1-end', 'hook2-start', 'hook2-end']);
    });

    it('should isolate afterCommit hooks between concurrent transactions', async () => {
      const hooks1: string[] = [];
      const hooks2: string[] = [];

      const promise1 = txManager.run(async () => {
        txManager.onAfterCommit(() => {
          hooks1.push('t1-hook1');
        });
        txManager.onAfterCommit(() => {
          hooks1.push('t1-hook2');
        });
      });

      const promise2 = txManager.run(async () => {
        txManager.onAfterCommit(() => {
          hooks2.push('t2-hook1');
        });
        txManager.onAfterCommit(() => {
          hooks2.push('t2-hook2');
        });
      });

      await Promise.all([promise1, promise2]);

      expect(hooks1).toEqual(['t1-hook1', 't1-hook2']);
      expect(hooks2).toEqual(['t2-hook1', 't2-hook2']);
    });
  });

  describe('memory pressure scenarios', () => {
    it('should handle many concurrent transactions without leaking context', async () => {
      const concurrentCount = 100;
      const results: number[] = [];

      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        txManager.run(async () => {
          expect(txManager.isInTransaction()).toBe(true);
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          results.push(i);
          return i;
        })
      );

      await Promise.all(promises);

      expect(results).toHaveLength(concurrentCount);
      expect(txManager.isInTransaction()).toBe(false);
      expect(txManager.getClient()).toBeNull();
    });

    it('should clean up context after transaction completes', async () => {
      const preCheck = txManager.isInTransaction();
      expect(preCheck).toBe(false);

      await txManager.run(async () => {
        expect(txManager.isInTransaction()).toBe(true);
      });

      const postCheck = txManager.isInTransaction();
      expect(postCheck).toBe(false);
    });
  });

  describe('propagation boundary conditions', () => {
    it('should handle REQUIRES_NEW within REQUIRED correctly', async () => {
      let outerClient: { id: string } | null = null;
      let innerClient: { id: string } | null = null;

      await txManager.run(async () => {
        outerClient = txManager.getClient();

        await txManager.suspend(async () => {
          await txManager.run(async () => {
            innerClient = txManager.getClient();
          });
        });

        const afterSuspend = txManager.getClient();
        expect(afterSuspend).toBe(outerClient);
      });

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(2);
      expect(outerClient).not.toBeNull();
      expect(innerClient).not.toBeNull();
    });

    it('should reject MANDATORY without existing transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'MANDATORY' })
        async execute() {
          return 'result';
        }
      }

      const service = new TestService();
      await expect(service.execute()).rejects.toThrow('MANDATORY propagation requires an existing transaction');
    });

    it('should reject NEVER with existing transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async outer() {
          return await this.inner();
        }

        @Transactional({ propagation: 'NEVER' })
        async inner() {
          return 'result';
        }
      }

      const service = new TestService();
      await expect(service.outer()).rejects.toThrow('NEVER propagation does not allow existing transaction');
    });

    it('should handle REQUIRED joining existing transaction', async () => {
      const clients: (string | null)[] = [];

      await txManager.run(async () => {
        clients.push(txManager.getClient()?.id ?? null);

        await txManager.run(async () => {
          clients.push(txManager.getClient()?.id ?? null);

          await txManager.run(async () => {
            clients.push(txManager.getClient()?.id ?? null);
          });
        });
      });

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(clients.every((id) => id === clients[0])).toBe(true);
    });
  });
});

describe('TxManager Transaction Timeout', () => {
  let txManager!: TxManager<{ id: string }>;
  let slowAdapter!: TxAdapter<{ id: string }>;
  let fastAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    TxManagerRegistry.clear();
  });

  describe('timeout with run options', () => {
    it('should timeout when transaction exceeds specified duration', async () => {
      slowAdapter = createMockAdapter({ delay: 200 });
      txManager = new TxManager(slowAdapter);

      await expect(
        txManager.run(
          async () => {
            return 'result';
          },
          { timeout: 50 }
        )
      ).rejects.toThrow(TransactionTimeoutProblem);
    });

    it('should abort underlying transaction work when timeout fires', async () => {
      let transactionSignal!: AbortSignal;
      const transaction = async <T>(
        _fn: (client: { id: string }) => Promise<T>,
        _options?: unknown,
        signal?: AbortSignal
      ): Promise<T> => {
        if (!signal) throw new TransactionTimeoutProblem(50);
        transactionSignal = signal;

        return await new Promise<T>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new TransactionTimeoutProblem(50)), { once: true });
        });
      };
      const abortableAdapter: TxAdapter<{ id: string }> = {
        transaction: vi.fn(transaction) as typeof transaction,
        savepoint: vi.fn(async (client, fn) => fn(client)),
        supportsSavepoint: () => true,
      };
      txManager = new TxManager(abortableAdapter);

      await expect(
        txManager.run(
          async () => {
            return 'result';
          },
          { timeout: 50 }
        )
      ).rejects.toThrow(TransactionTimeoutProblem);

      expect(transactionSignal.aborted).toBe(true);
    });

    it('should complete successfully when transaction is within timeout', async () => {
      fastAdapter = createMockAdapter({ delay: 10 });
      txManager = new TxManager(fastAdapter);

      const result = await txManager.run(
        async () => {
          return 'success';
        },
        { timeout: 100 }
      );

      expect(result).toBe('success');
    });

    it('should not timeout when timeout is not specified', async () => {
      slowAdapter = createMockAdapter({ delay: 100 });
      txManager = new TxManager(slowAdapter);

      const result = await txManager.run(async () => {
        await new Promise((r) => setTimeout(r, 150));
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('timeout with default config', () => {
    it('should use default timeout from config', async () => {
      slowAdapter = createMockAdapter({ delay: 200 });
      txManager = new TxManager(slowAdapter, { defaultTimeout: 50 });

      await expect(
        txManager.run(async () => {
          return 'result';
        })
      ).rejects.toThrow(TransactionTimeoutProblem);
    });

    it('should allow override of default timeout', async () => {
      slowAdapter = createMockAdapter({ delay: 200 });
      txManager = new TxManager(slowAdapter, { defaultTimeout: 50 });

      const result = await txManager.run(
        async () => {
          await new Promise((r) => setTimeout(r, 100));
          return 'success';
        },
        { timeout: 500 }
      );

      expect(result).toBe('success');
    });
  });

  describe('timeout with savepoint nesting', () => {
    it('should timeout during savepoint execution', async () => {
      const savepointAdapter: TxAdapter<{ id: string }> = {
        transaction: vi.fn(async (fn) => {
          const client = { id: 'tx-client' };
          return fn(client);
        }),
        savepoint: vi.fn(async (_client, fn) => {
          await new Promise((r) => setTimeout(r, 200));
          return fn({ id: 'nested-client' });
        }),
        supportsSavepoint: () => true,
      };

      txManager = new TxManager(savepointAdapter, { defaultNesting: 'savepoint' });

      await expect(
        txManager.run(
          async () => {
            return await txManager.run(
              async () => {
                return 'result';
              },
              { timeout: 50 }
            );
          },
          { timeout: 1000 }
        )
      ).rejects.toThrow(TransactionTimeoutProblem);
    });
  });

  describe('timeout error details', () => {
    it('should include timeout duration in error', async () => {
      slowAdapter = createMockAdapter({ delay: 200 });
      txManager = new TxManager(slowAdapter);

      await expect(
        txManager.run(
          async () => {
            return 'result';
          },
          { timeout: 50 }
        )
      ).rejects.toMatchObject({
        code: 'tx-core/transaction-timeout',
        message: 'Transaction timed out after 50ms',
      });
    });
  });
});

describe('TxManager @Transactional timeout propagation', () => {
  let txManager!: TxManager<{ id: string }>;
  let slowAdapter!: TxAdapter<{ id: string }>;
  let fastAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    TxManagerRegistry.clear();
    slowAdapter = createMockAdapter({ delay: 200 });
    txManager = new TxManager(slowAdapter);
    TxManagerRegistry.register(txManager);
  });

  it('should propagate timeout through @Transactional decorator', async () => {
    class TestService {
      @Transactional({ timeout: 50 })
      async slowOperation() {
        await new Promise((r) => setTimeout(r, 100));
        return 'result';
      }
    }

    const service = new TestService();
    await expect(service.slowOperation()).rejects.toThrow(TransactionTimeoutProblem);
  });

  it('should complete successfully when within timeout via decorator', async () => {
    fastAdapter = createMockAdapter({ delay: 10 });
    TxManagerRegistry.clear();
    txManager = new TxManager(fastAdapter);
    TxManagerRegistry.register(txManager);

    class TestService {
      @Transactional({ timeout: 100 })
      async fastOperation() {
        await new Promise((r) => setTimeout(r, 20));
        return 'success';
      }
    }

    const service = new TestService();
    const result = await service.fastOperation();
    expect(result).toBe('success');
  });
});
