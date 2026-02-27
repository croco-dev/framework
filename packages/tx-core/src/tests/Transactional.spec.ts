import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Transactional,
  type TxAdapter,
  TxManager,
  TxManagerNotRegisteredError,
  TxManagerRegistry,
  TxPropagationError,
} from '../index';

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

describe('TxManagerRegistry', () => {
  let mockAdapter!: TxAdapter<{ id: string }>;
  let txManager!: TxManager<{ id: string }>;

  beforeEach(() => {
    TxManagerRegistry.clear();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
  });

  afterEach(() => {
    TxManagerRegistry.clear();
  });

  describe('register', () => {
    it('should register manager with default key', () => {
      TxManagerRegistry.register(txManager);
      expect(TxManagerRegistry.has()).toBe(true);
    });

    it('should register manager with custom key', () => {
      TxManagerRegistry.register(txManager, 'custom-key');
      expect(TxManagerRegistry.has('custom-key')).toBe(true);
    });

    it('should allow multiple managers with different keys', () => {
      const txManager2 = new TxManager(createMockAdapter());
      TxManagerRegistry.register(txManager, 'key1');
      TxManagerRegistry.register(txManager2, 'key2');

      expect(TxManagerRegistry.get('key1')).toBe(txManager);
      expect(TxManagerRegistry.get('key2')).toBe(txManager2);
    });
  });

  describe('get', () => {
    it('should return registered manager with default key', () => {
      TxManagerRegistry.register(txManager);
      const result = TxManagerRegistry.get();
      expect(result).toBe(txManager);
    });

    it('should return registered manager with custom key', () => {
      TxManagerRegistry.register(txManager, 'custom-key');
      const result = TxManagerRegistry.get('custom-key');
      expect(result).toBe(txManager);
    });

    it('should throw TxManagerNotRegisteredError when manager not registered', () => {
      expect(() => TxManagerRegistry.get('nonexistent')).toThrow(TxManagerNotRegisteredError);
      expect(() => TxManagerRegistry.get('nonexistent')).toThrow('TxManager not registered for key: nonexistent');
    });
  });

  describe('has', () => {
    it('should return false when no manager registered', () => {
      expect(TxManagerRegistry.has()).toBe(false);
    });

    it('should return true when manager registered with default key', () => {
      TxManagerRegistry.register(txManager);
      expect(TxManagerRegistry.has()).toBe(true);
    });

    it('should return true when manager registered with custom key', () => {
      TxManagerRegistry.register(txManager, 'custom-key');
      expect(TxManagerRegistry.has('custom-key')).toBe(true);
    });

    it('should return false for unregistered key', () => {
      TxManagerRegistry.register(txManager, 'key1');
      expect(TxManagerRegistry.has('key2')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all registered managers', () => {
      TxManagerRegistry.register(txManager, 'key1');
      TxManagerRegistry.register(new TxManager(createMockAdapter()), 'key2');

      TxManagerRegistry.clear();

      expect(TxManagerRegistry.has('key1')).toBe(false);
      expect(TxManagerRegistry.has('key2')).toBe(false);
    });

    it('should allow re-registering after clear', () => {
      TxManagerRegistry.register(txManager);
      TxManagerRegistry.clear();
      expect(TxManagerRegistry.has()).toBe(false);

      TxManagerRegistry.register(txManager);
      expect(TxManagerRegistry.has()).toBe(true);
    });
  });
});

describe('@Transactional decorator', () => {
  let txManager!: TxManager<{ id: string }>;
  let mockAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    TxManagerRegistry.clear();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
    TxManagerRegistry.register(txManager);
  });

  afterEach(() => {
    TxManagerRegistry.clear();
  });

  describe('REQUIRED propagation', () => {
    it('should create new transaction when not in transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async execute() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe('result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should join existing transaction when in transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async outer() {
          return await this.inner();
        }

        @Transactional({ propagation: 'REQUIRED' })
        async inner() {
          return 'nested-result';
        }
      }

      const service = new TestService();
      const result = await service.outer();

      expect(result).toBe('nested-result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should use default propagation (REQUIRED) when not specified', async () => {
      class TestService {
        @Transactional()
        async execute() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe('result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('REQUIRES_NEW propagation', () => {
    it('should suspend existing transaction and create new one', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async outer() {
          const outerClientId = txManager.getClient()?.id;
          await this.inner();
          const afterInnerClientId = txManager.getClient()?.id;
          return { outerClientId, afterInnerClientId };
        }

        @Transactional({ propagation: 'REQUIRES_NEW' })
        async inner() {
          const innerClientId = txManager.getClient()?.id;
          return { innerClientId };
        }
      }

      const service = new TestService();
      await service.outer();

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(2);
    });

    it('should create new transaction even when not in existing transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRES_NEW' })
        async execute() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe('result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('MANDATORY propagation', () => {
    it('should execute normally when in existing transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async outer() {
          return await this.inner();
        }

        @Transactional({ propagation: 'MANDATORY' })
        async inner() {
          return 'mandatory-result';
        }
      }

      const service = new TestService();
      const result = await service.outer();

      expect(result).toBe('mandatory-result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw TxPropagationError when not in transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'MANDATORY' })
        async execute() {
          return 'result';
        }
      }

      const service = new TestService();

      await expect(service.execute()).rejects.toThrow(TxPropagationError);
      await expect(service.execute()).rejects.toThrow('MANDATORY propagation requires an existing transaction');
      expect(mockAdapter.transaction).not.toHaveBeenCalled();
    });
  });

  describe('NEVER propagation', () => {
    it('should execute normally when not in transaction', async () => {
      class TestService {
        @Transactional({ propagation: 'NEVER' })
        async execute() {
          return 'never-result';
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe('never-result');
      expect(mockAdapter.transaction).not.toHaveBeenCalled();
    });

    it('should throw TxPropagationError when in transaction', async () => {
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

      await expect(service.outer()).rejects.toThrow(TxPropagationError);
      await expect(service.outer()).rejects.toThrow('NEVER propagation does not allow existing transaction');
    });
  });

  describe('custom managerKey', () => {
    it('should use different TxManager with custom key', async () => {
      const customAdapter = createMockAdapter();
      const customTxManager = new TxManager(customAdapter);
      TxManagerRegistry.register(customTxManager, 'custom-key');

      class TestService {
        @Transactional({ managerKey: 'custom-key' })
        async withCustomManager() {
          return 'custom-result';
        }

        @Transactional()
        async withDefaultManager() {
          return 'default-result';
        }
      }

      const service = new TestService();
      await service.withCustomManager();
      await service.withDefaultManager();

      expect(customAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from decorated method', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async executeWithError() {
          throw new Error('Method error');
        }
      }

      const service = new TestService();

      await expect(service.executeWithError()).rejects.toThrow('Method error');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors through nested transactions', async () => {
      class TestService {
        @Transactional({ propagation: 'REQUIRED' })
        async outer() {
          await this.inner();
        }

        @Transactional({ propagation: 'REQUIRED' })
        async inner() {
          throw new Error('Inner error');
        }
      }

      const service = new TestService();

      await expect(service.outer()).rejects.toThrow('Inner error');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom options', () => {
    it('should pass custom options to txManager.run', async () => {
      class TestService {
        @Transactional({
          nesting: 'savepoint',
          options: { timeout: 1000 },
        })
        async withOptions() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = await service.withOptions();

      expect(result).toBe('result');
      expect(mockAdapter.transaction).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle method with multiple arguments', async () => {
      class TestService {
        @Transactional()
        async sum(a: number, b: number, c: number) {
          return a + b + c;
        }
      }

      const service = new TestService();
      const result = await service.sum(1, 2, 3);

      expect(result).toBe(6);
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle method returning promise', async () => {
      class TestService {
        @Transactional()
        async asyncOperation() {
          return Promise.resolve('async-result');
        }
      }

      const service = new TestService();
      const result = await service.asyncOperation();

      expect(result).toBe('async-result');
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle method returning undefined', async () => {
      class TestService {
        @Transactional()
        async voidOperation() {}
      }

      const service = new TestService();
      const result = await service.voidOperation();

      expect(result).toBeUndefined();
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
