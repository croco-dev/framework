import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type TxAdapter, TxManager } from "../index";

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

describe("TxManager", () => {
  let txManager!: TxManager<{ id: string }>;
  let mockAdapter!: TxAdapter<{ id: string }>;

  beforeEach(() => {
    Container.reset();
    mockAdapter = createMockAdapter();
    txManager = new TxManager(mockAdapter);
  });

  describe("run", () => {
    it("should execute function within transaction", async () => {
      const result = await txManager.run(async () => {
        return "success";
      });

      expect(result).toBe("success");
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });

    it("should provide client within transaction", async () => {
      await txManager.run(async () => {
        const client = txManager.getClient();
        expect(client).not.toBeUndefined();
        expect(client?.id).toBe("tx-client");
      });
    });

    it("should propagate errors from transaction", async () => {
      await expect(
        txManager.run(async () => {
          throw new Error("Transaction failed");
        }),
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("isInTransaction", () => {
    it("should return false outside transaction", () => {
      expect(txManager.isInTransaction()).toBe(false);
    });

    it("should return true inside transaction", async () => {
      await txManager.run(async () => {
        expect(txManager.isInTransaction()).toBe(true);
      });
    });

    it("should return false after transaction completes", async () => {
      await txManager.run(async () => {});
      expect(txManager.isInTransaction()).toBe(false);
    });
  });

  describe("getClient", () => {
    it("should return null outside transaction", () => {
      expect(txManager.getClient()).toBeNull();
    });

    it("should return client inside transaction", async () => {
      await txManager.run(async () => {
        const client = txManager.getClient();
        expect(client).toEqual({ id: "tx-client" });
      });
    });
  });

  describe("nesting with join strategy", () => {
    it("should reuse existing transaction by default", async () => {
      await txManager.run(async () => {
        await txManager.run(async () => {
          expect(txManager.isInTransaction()).toBe(true);
        });
      });

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("nesting with savepoint strategy", () => {
    it("should create savepoint for nested transaction", async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: "savepoint" });

      await savepointTxManager.runWithOutcome(async () => {
        await savepointTxManager.run(async () => {
          expect(savepointTxManager.isInTransaction()).toBe(true);
        });
      });

      expect(savepointAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(savepointAdapter.savepoint).toHaveBeenCalledTimes(1);
    });

    it("should fall back to join if savepoint not supported", async () => {
      const noSavepointAdapter = createMockAdapter({ supportsSavepoint: false });
      const noSavepointTxManager = new TxManager(noSavepointAdapter, {
        defaultNesting: "savepoint",
      });
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await noSavepointTxManager.run(async () => {
        await noSavepointTxManager.run(async () => {
          expect(noSavepointTxManager.isInTransaction()).toBe(true);
        });
      });

      expect(noSavepointAdapter.transaction).toHaveBeenCalledTimes(1);
      expect(noSavepointAdapter.savepoint).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[TxManager] Savepoint nesting requested but adapter does not support savepoint. Falling back to join.",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should discard savepoint hooks when savepoint rolls back", async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: "savepoint" });
      const rolledBackHook = vi.fn();

      await savepointTxManager.runWithOutcome(async () => {
        await expect(
          savepointTxManager.run(async () => {
            savepointTxManager.onAfterCommit(rolledBackHook);
            throw new Error("savepoint rollback");
          }),
        ).rejects.toThrow("savepoint rollback");
      });

      expect(rolledBackHook).not.toHaveBeenCalled();
    });

    it("should discard savepoint hooks when adapter swallows rollback error", async () => {
      const savepointAdapter: TxAdapter<{ id: string }> = {
        transaction: vi.fn(async (fn) => {
          const client = { id: "tx-client" };
          return fn(client);
        }),
        savepoint: vi.fn(async (client, fn) => {
          try {
            return await fn(client);
          } catch {
            return "rolled-back";
          }
        }),
        supportsSavepoint: () => true,
      };
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: "savepoint" });
      const rolledBackHook = vi.fn();

      await savepointTxManager.runWithOutcome(async () => {
        const nestedResult = await savepointTxManager.run(async () => {
          savepointTxManager.onAfterCommit(rolledBackHook);
          throw new Error("savepoint rollback");
        });

        expect(nestedResult).toBe("rolled-back");
      });

      expect(rolledBackHook).not.toHaveBeenCalled();
    });

    it("should execute savepoint hooks after root commit when savepoint succeeds", async () => {
      const savepointAdapter = createMockAdapter({ supportsSavepoint: true });
      const savepointTxManager = new TxManager(savepointAdapter, { defaultNesting: "savepoint" });
      const rootHook = vi.fn();
      const savepointHook = vi.fn();

      await savepointTxManager.runWithOutcome(async () => {
        savepointTxManager.onAfterCommit(rootHook);

        await savepointTxManager.run(async () => {
          savepointTxManager.onAfterCommit(savepointHook);
        });
      });

      expect(rootHook).toHaveBeenCalledTimes(1);
      expect(savepointHook).toHaveBeenCalledTimes(1);
    });

    it("should clear transaction context before running afterCommit hooks", async () => {
      const observedClients: Array<{ id: string } | null> = [];
      const observedTransactionStates: boolean[] = [];

      await txManager.runWithOutcome(async () => {
        txManager.onAfterCommit(async () => {
          observedClients.push(txManager.getClient());
          observedTransactionStates.push(txManager.isInTransaction());
        });
      });

      expect(observedClients).toEqual([null]);
      expect(observedTransactionStates).toEqual([false]);
      expect(txManager.getClient()).toBeNull();
    });

    it("should preserve row durability and return degraded evidence after a hook failure", async () => {
      type DurableClient = {
        insert(row: string): void;
      };
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const observedClients: Array<DurableClient | null> = [];
      const observedTransactionStates: boolean[] = [];
      const rows: string[] = [];
      const durableAdapter: TxAdapter<DurableClient> = {
        transaction: vi.fn(async (fn) => {
          const pendingRows: string[] = [];
          const result = await fn({
            insert(row: string) {
              pendingRows.push(row);
            },
          });
          rows.push(...pendingRows);
          return result;
        }),
        savepoint: vi.fn(async (client, fn) => fn(client)),
        supportsSavepoint: () => true,
      };
      const durableTxManager = new TxManager(durableAdapter);

      const outcome = await durableTxManager.runWithOutcome(async () => {
        durableTxManager.getClient()?.insert("order-1");
        durableTxManager.onAfterCommit(async () => {
          observedClients.push(durableTxManager.getClient());
          observedTransactionStates.push(durableTxManager.isInTransaction());
          throw new Error("post-commit event publish failed");
        });
        return "order-1";
      });

      expect(rows).toEqual(["order-1"]);
      expect(outcome.status).toBe("committed");
      expect(outcome.value).toBe("order-1");
      expect(outcome.afterCommit.status).toBe("failed");
      expect(observedClients).toEqual([null]);
      expect(observedTransactionStates).toEqual([false]);
      expect(durableTxManager.getClient()).toBeNull();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("should reject runWithOutcome before joining an active transaction", async () => {
      await txManager.run(async () => {
        await expect(txManager.runWithOutcome(async () => "nested")).rejects.toMatchObject({
          code: "tx-core/outcome-requires-root",
        });
      });
    });
  });

  describe("run with options", () => {
    it("should accept nesting strategy option", async () => {
      await txManager.run(
        async () => {
          await txManager.run(
            async () => {
              expect(txManager.isInTransaction()).toBe(true);
            },
            { nesting: "join" },
          );
        },
        { nesting: "join" },
      );

      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1);
    });
  });
});

describe("TxAdapter interface", () => {
  it("should have required methods", () => {
    const adapter = createMockAdapter();

    expect(typeof adapter.transaction).toBe("function");
    expect(typeof adapter.savepoint).toBe("function");
    expect(typeof adapter.supportsSavepoint).toBe("function");
  });
});
