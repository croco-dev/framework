import { Container } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DuplicateTxManagerRegistrationProblem,
  Transactional,
  type TxAdapter,
  TxManager,
  TxManagerNotRegisteredError,
  TxManagerRegistry,
  TxPropagationError,
} from "../index";

function createMockAdapter(
  options: { supportsSavepoint?: boolean } = {},
): TxAdapter<{ id: string }> {
  return {
    transaction: vi.fn(async (fn) => {
      const client = { id: "tx-client" };
      return fn(client);
    }),
    savepoint: vi.fn(async (client, fn) => {
      return fn(client);
    }),
    supportsSavepoint: () => options.supportsSavepoint ?? true,
  };
}

describe("TxManagerRegistry", () => {
  const registry = new TxManagerRegistry();
  it("isolates named managers between application-owned registries", () => {
    const first = new TxManagerRegistry();
    const second = new TxManagerRegistry();
    const manager = new TxManager(createMockAdapter());
    first.register(manager, "billing");
    expect(first.get("billing")).toBe(manager);
    expect(second.has("billing")).toBe(false);
    expect(() => second.get("billing")).toThrow(TxManagerNotRegisteredError);
    second.clear();
    expect(first.get("billing")).toBe(manager);
  });
  let mockAdapter!: TxAdapter<{ id: string }>;
  let txManager!: TxManager<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    registry.clear();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
  });

  afterEach(() => {
    Container.reset();
    registry.clear();
  });

  describe("register", () => {
    it("should register manager with default key", () => {
      registry.register(txManager);
      expect(registry.has()).toBe(true);
    });

    it("should register manager with custom key", () => {
      registry.register(txManager, "custom-key");
      expect(registry.has("custom-key")).toBe(true);
    });

    it("should allow multiple managers with different keys", () => {
      const txManager2 = new TxManager(createMockAdapter());
      registry.register(txManager, "key1");
      registry.register(txManager2, "key2");

      expect(registry.get("key1")).toBe(txManager);
      expect(registry.get("key2")).toBe(txManager2);
    });

    it("should fail fast when the default manager is registered twice", () => {
      const txManager2 = new TxManager(createMockAdapter());

      registry.register(txManager);

      expect(() => registry.register(txManager2)).toThrow(DuplicateTxManagerRegistrationProblem);
      expect(registry.get()).toBe(txManager);
    });

    it("should fail fast when the same custom key is registered twice", () => {
      const txManager2 = new TxManager(createMockAdapter());

      registry.register(txManager, "custom-key");

      expect(() => registry.register(txManager2, "custom-key")).toThrow(
        DuplicateTxManagerRegistrationProblem,
      );
      expect(registry.get("custom-key")).toBe(txManager);
    });

    it("should keep existing bindings unchanged when duplicate default registration fails", () => {
      const txManager2 = new TxManager(createMockAdapter());

      registry.register(txManager);

      expect(() => registry.register(txManager2)).toThrow(DuplicateTxManagerRegistrationProblem);
      expect(registry.has()).toBe(true);
      expect(registry.get()).toBe(txManager);
    });
  });

  describe("get", () => {
    it("should return registered manager with default key", () => {
      registry.register(txManager);
      const result = registry.get();
      expect(result).toBe(txManager);
    });

    it("should return registered manager with custom key", () => {
      registry.register(txManager, "custom-key");
      const result = registry.get("custom-key");
      expect(result).toBe(txManager);
    });

    it("should throw TxManagerNotRegisteredError when manager not registered", () => {
      expect(() => registry.get("nonexistent")).toThrow(TxManagerNotRegisteredError);
      expect(() => registry.get("nonexistent")).toThrow(
        "TxManager not registered for key: nonexistent",
      );
    });
  });

  describe("has", () => {
    it("should return false when no manager registered", () => {
      expect(registry.has()).toBe(false);
    });

    it("should return true when manager registered with default key", () => {
      registry.register(txManager);
      expect(registry.has()).toBe(true);
    });

    it("should return true when manager registered with custom key", () => {
      registry.register(txManager, "custom-key");
      expect(registry.has("custom-key")).toBe(true);
    });

    it("should return false for unregistered key", () => {
      registry.register(txManager, "key1");
      expect(registry.has("key2")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all registered managers", () => {
      registry.register(txManager, "key1");
      registry.register(new TxManager(createMockAdapter()), "key2");

      registry.clear();

      expect(registry.has("key1")).toBe(false);
      expect(registry.has("key2")).toBe(false);
    });

    it("should allow re-registering after clear", () => {
      registry.register(txManager);
      registry.clear();
      expect(registry.has()).toBe(false);

      registry.register(txManager);
      expect(registry.has()).toBe(true);
    });

    it("should allow re-registering the same key after clear", () => {
      const txManager2 = new TxManager(createMockAdapter());

      registry.register(txManager, "custom-key");
      registry.clear();

      registry.register(txManager2, "custom-key");

      expect(registry.get("custom-key")).toBe(txManager2);
    });
  });
});

describe("@Transactional decorator", () => {
  const registry = new TxManagerRegistry();
  let txManager!: TxManager<{ id: string }>;
  let mockAdapter!: TxAdapter<{ id: string }>;

  it("uses the manager injected into each receiver without cross-application state", async () => {
    class Service {
      constructor(readonly manager: TxManager<{ id: string }>) {}

      @Transactional((service: Service) => service.manager)
      async execute() {
        return this.manager.getClient();
      }
    }
    const firstAdapter = createMockAdapter();
    const secondAdapter = createMockAdapter();
    const first = new Service(new TxManager(firstAdapter));
    const second = new Service(new TxManager(secondAdapter));
    await Promise.all([first.execute(), second.execute()]);
    expect(firstAdapter.transaction).toHaveBeenCalledTimes(1);
    expect(secondAdapter.transaction).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    registry.clear();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
    registry.register(txManager);
  });

  afterEach(() => {
    registry.clear();
  });

  describe("REQUIRED propagation", () => {
    it("should create new transaction when not in transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async execute() {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe("result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should join existing transaction when in transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async outer() {
          return await this.inner();
        }

        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async inner() {
          return "nested-result";
        }
      }

      const service = new TestService();
      const result = await service.outer();

      expect(result).toBe("nested-result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should use default propagation (REQUIRED) when not specified", async () => {
      class TestService {
        @Transactional(() => txManager)
        async execute() {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe("result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("REQUIRES_NEW propagation", () => {
    it("should suspend existing transaction and create new one", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async outer() {
          const outerClientId = txManager.getClient()?.id;
          await this.inner();
          const afterInnerClientId = txManager.getClient()?.id;
          return { outerClientId, afterInnerClientId };
        }

        @Transactional(() => txManager, { propagation: "REQUIRES_NEW" })
        async inner() {
          const innerClientId = txManager.getClient()?.id;
          return { innerClientId };
        }
      }

      const service = new TestService();
      await service.outer();

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(2);
    });

    it("should create new transaction even when not in existing transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRES_NEW" })
        async execute() {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe("result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("MANDATORY propagation", () => {
    it("should execute normally when in existing transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async outer() {
          return await this.inner();
        }

        @Transactional(() => txManager, { propagation: "MANDATORY" })
        async inner() {
          return "mandatory-result";
        }
      }

      const service = new TestService();
      const result = await service.outer();

      expect(result).toBe("mandatory-result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should throw TxPropagationError when not in transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "MANDATORY" })
        async execute() {
          return "result";
        }
      }

      const service = new TestService();

      await expect(service.execute()).rejects.toThrow(TxPropagationError);
      await expect(service.execute()).rejects.toThrow(
        "MANDATORY propagation requires an existing transaction",
      );
      expect(mockAdapter.transaction).not.toHaveBeenCalled();
    });
  });

  describe("NEVER propagation", () => {
    it("should execute normally when not in transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "NEVER" })
        async execute() {
          return "never-result";
        }
      }

      const service = new TestService();
      const result = await service.execute();

      expect(result).toBe("never-result");
      expect(mockAdapter.transaction).not.toHaveBeenCalled();
    });

    it("should throw TxPropagationError when in transaction", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async outer() {
          return await this.inner();
        }

        @Transactional(() => txManager, { propagation: "NEVER" })
        async inner() {
          return "result";
        }
      }

      const service = new TestService();

      await expect(service.outer()).rejects.toThrow(TxPropagationError);
      await expect(service.outer()).rejects.toThrow(
        "NEVER propagation does not allow existing transaction",
      );
    });
  });

  describe("custom managerKey", () => {
    it("should use different TxManager with custom key", async () => {
      const customAdapter = createMockAdapter();
      const customTxManager = new TxManager(customAdapter);
      registry.register(customTxManager, "custom-key");

      class TestService {
        @Transactional(() => registry.get("custom-key"))
        async withCustomManager() {
          return "custom-result";
        }

        @Transactional(() => txManager)
        async withDefaultManager() {
          return "default-result";
        }
      }

      const service = new TestService();
      await service.withCustomManager();
      await service.withDefaultManager();

      expect(customAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("error propagation", () => {
    it("should propagate errors from decorated method", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async executeWithError() {
          throw new Error("Method error");
        }
      }

      const service = new TestService();

      await expect(service.executeWithError()).rejects.toThrow("Method error");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors through nested transactions", async () => {
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async outer() {
          await this.inner();
        }

        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async inner() {
          throw new Error("Inner error");
        }
      }

      const service = new TestService();

      await expect(service.outer()).rejects.toThrow("Inner error");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should reject decorated afterCommit registration before its outcome can be discarded", async () => {
      const hook = vi.fn();
      class TestService {
        @Transactional(() => txManager, { propagation: "REQUIRED" })
        async execute() {
          txManager.onAfterCommit(hook);
          return "result";
        }
      }

      const service = new TestService();

      await expect(service.execute()).rejects.toMatchObject({
        code: "tx-core/after-commit-outcome-required",
      });
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(hook).not.toHaveBeenCalled();
    });
  });

  describe("custom options", () => {
    it("should pass custom options to txManager.run", async () => {
      class TestService {
        @Transactional(() => txManager, {
          nesting: "savepoint",
          options: { timeout: 1000 },
        })
        async withOptions() {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.withOptions();

      expect(result).toBe("result");
      expect(mockAdapter.transaction).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle method with multiple arguments", async () => {
      class TestService {
        @Transactional(() => txManager)
        async sum(a: number, b: number, c: number) {
          return a + b + c;
        }
      }

      const service = new TestService();
      const result = await service.sum(1, 2, 3);

      expect(result).toBe(6);
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should handle method returning promise", async () => {
      class TestService {
        @Transactional(() => txManager)
        async asyncOperation() {
          return Promise.resolve("async-result");
        }
      }

      const service = new TestService();
      const result = await service.asyncOperation();

      expect(result).toBe("async-result");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should handle method returning undefined", async () => {
      class TestService {
        @Transactional(() => txManager)
        async voidOperation() {}
      }

      const service = new TestService();
      const result = await service.voidOperation();

      expect(result).toBeUndefined();
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
