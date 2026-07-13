import type { TxAdapter } from "@croco/tx-core";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  createDrizzleTxAdapter,
  createRlsTxAdapter,
  RlsConfigurationProblem,
  RlsExecuteUnsupportedProblem,
  SavepointUnsupportedProblem,
} from "../index";

interface MockTx {
  id: string;
}

interface MockExecutableTx extends MockTx {
  execute(query: unknown): Promise<string>;
}

interface MockInsertExecutable {
  execute(): Promise<string>;
}

interface MockInsertBuilder {
  values(row: unknown): MockInsertExecutable;
}

interface MockBuilderTx extends MockTx {
  insert(table: string): MockInsertBuilder;
  query: {
    users: {
      findFirst(): Promise<string>;
    };
  };
}

interface MockNestedTx extends MockTx {
  transaction<T>(fn: (tx: MockNestedTx) => Promise<T>): Promise<T>;
}

interface MockExecutableNestedTx extends MockExecutableTx {
  transaction<T>(fn: (tx: MockExecutableNestedTx) => Promise<T>): Promise<T>;
}

interface MockRlsTx extends MockTx {
  execute(query: unknown): Promise<void>;
}

interface MockDrizzleDb<TClient> {
  transaction<T>(fn: (tx: TClient) => Promise<T>): Promise<T>;
}

describe("DrizzleTxAdapter", () => {
  function createMockDrizzleDb() {
    const transactionFn = async <T>(fn: (tx: MockTx) => Promise<T>): Promise<T> => {
      const tx: MockTx = { id: "drizzle-tx" };
      return fn(tx);
    };

    return {
      transaction: vi.fn(transactionFn) as typeof transactionFn,
    };
  }

  it("should create adapter from drizzle db", () => {
    const db = createMockDrizzleDb();
    const adapter = createDrizzleTxAdapter(db);

    expect(adapter).not.toBeUndefined();
    expect(typeof adapter.transaction).toBe("function");
    expect(typeof adapter.savepoint).toBe("function");
    expect(typeof adapter.supportsSavepoint).toBe("function");
  });

  describe("transaction", () => {
    it("should delegate to drizzle db.transaction", async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;

      const result = await adapter.transaction(async (tx) => {
        expect(tx.id).toBe("drizzle-tx");
        return "result";
      });

      expect(result).toBe("result");
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors", async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);

      await expect(
        adapter.transaction(async () => {
          throw new Error("DB error");
        }),
      ).rejects.toThrow("DB error");
    });

    it("should rollback and block transaction client calls after abort", async () => {
      const execute = vi.fn(async (_query: unknown) => "write-result");
      const lifecycle: string[] = [];
      const transaction = async <T>(fn: (tx: MockExecutableTx) => Promise<T>): Promise<T> => {
        try {
          const result = await fn({ id: "drizzle-tx", execute });
          lifecycle.push("commit");
          return result;
        } catch (error) {
          lifecycle.push("rollback");
          throw error;
        }
      };
      const db: MockDrizzleDb<MockExecutableTx> = {
        transaction: vi.fn(transaction) as typeof transaction,
      };
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockExecutableTx>;
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 50ms");

      const transactionPromise = adapter.transaction(
        async (tx) => {
          lifecycle.push("callback:start");
          await new Promise((resolve) => setTimeout(resolve, 30));
          lifecycle.push("callback:after-timeout");
          await tx.execute("insert");
          lifecycle.push("callback:write-finished");
          return "result";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(timeout);

      await expect(transactionPromise).rejects.toBe(timeout);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lifecycle).toEqual(["callback:start", "rollback", "callback:after-timeout"]);
      expect(execute).not.toHaveBeenCalled();
    });

    it("should wait for transaction rollback cleanup before rejecting after abort", async () => {
      const lifecycle: string[] = [];
      const transaction = async <T>(fn: (tx: MockTx) => Promise<T>): Promise<T> => {
        try {
          const result = await fn({ id: "drizzle-tx" });
          lifecycle.push("commit");
          return result;
        } catch (error) {
          lifecycle.push("rollback:start");
          await new Promise((resolve) => setTimeout(resolve, 30));
          lifecycle.push("rollback:end");
          throw error;
        }
      };
      const db: MockDrizzleDb<MockTx> = {
        transaction: vi.fn(transaction) as typeof transaction,
      };
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 50ms");

      const transactionPromise = adapter.transaction(
        async () => {
          lifecycle.push("callback:start");
          await new Promise<never>(() => undefined);
        },
        undefined,
        controller.signal,
      );
      let settled = false;
      void transactionPromise
        .finally(() => {
          settled = true;
        })
        .catch(() => undefined);

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(timeout);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(settled).toBe(false);
      expect(lifecycle).toEqual(["callback:start", "rollback:start"]);

      await expect(transactionPromise).rejects.toBe(timeout);
      expect(lifecycle).toEqual(["callback:start", "rollback:start", "rollback:end"]);
    });

    it("should block stored builders and nested query clients after abort", async () => {
      const execute = vi.fn(async () => "inserted");
      const findFirst = vi.fn(async () => "found");
      const tx: MockBuilderTx = {
        id: "drizzle-tx",
        insert: vi.fn((_table: string) => ({
          values: vi.fn((_row: unknown) => ({ execute })),
        })),
        query: {
          users: {
            findFirst,
          },
        },
      };
      const transaction = async <T>(fn: (tx: MockBuilderTx) => Promise<T>): Promise<T> => {
        return fn(tx);
      };
      const db: MockDrizzleDb<MockBuilderTx> = {
        transaction: vi.fn(transaction) as typeof transaction,
      };
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockBuilderTx>;
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 50ms");
      let postAbortProbe: Promise<void> = Promise.resolve();

      const transactionPromise = adapter.transaction(
        async (client) => {
          const insertStatement = client.insert("users").values({ id: "user-1" });
          const usersQuery = client.query.users;

          postAbortProbe = (async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(() => insertStatement.execute()).toThrow(timeout);
            expect(() => usersQuery.findFirst()).toThrow(timeout);
          })();

          await postAbortProbe;
          return "result";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(timeout);

      await expect(transactionPromise).rejects.toBe(timeout);
      await expect(postAbortProbe).resolves.toBeUndefined();
      expect(execute).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
    });
  });

  describe("supportsSavepoint", () => {
    it("should return true", () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);

      expect(adapter.supportsSavepoint()).toBe(true);
    });
  });

  describe("savepoint", () => {
    it("should delegate to nested transaction client when savepoint is supported", async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockNestedTx>;
      const nestedTransactionSpy = vi.fn();

      const client: MockNestedTx = {
        id: "existing-tx",
        transaction: async <T>(fn: (tx: MockNestedTx) => Promise<T>): Promise<T> => {
          nestedTransactionSpy();
          return fn(client);
        },
      };

      const result = await adapter.savepoint(client, async (tx) => {
        expect(tx.id).toBe("existing-tx");
        return "savepoint-result";
      });

      expect(result).toBe("savepoint-result");
      expect(nestedTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it("should rollback and block savepoint client calls after abort", async () => {
      const execute = vi.fn(async (_query: unknown) => "write-result");
      const lifecycle: string[] = [];
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockExecutableNestedTx>;
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 50ms");
      const client: MockExecutableNestedTx = {
        id: "existing-tx",
        execute,
        transaction: async <T>(fn: (tx: MockExecutableNestedTx) => Promise<T>): Promise<T> => {
          try {
            const result = await fn(client);
            lifecycle.push("release");
            return result;
          } catch (error) {
            lifecycle.push("rollback");
            throw error;
          }
        },
      };

      const savepointPromise = adapter.savepoint(
        client,
        async (tx) => {
          lifecycle.push("callback:start");
          await new Promise((resolve) => setTimeout(resolve, 30));
          lifecycle.push("callback:after-timeout");
          await tx.execute("insert");
          lifecycle.push("callback:write-finished");
          return "result";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(timeout);

      await expect(savepointPromise).rejects.toBe(timeout);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lifecycle).toEqual(["callback:start", "rollback", "callback:after-timeout"]);
      expect(execute).not.toHaveBeenCalled();
    });

    it("should wait for savepoint rollback cleanup before rejecting after abort", async () => {
      const lifecycle: string[] = [];
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockNestedTx>;
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 50ms");
      const client: MockNestedTx = {
        id: "existing-tx",
        transaction: async <T>(fn: (tx: MockNestedTx) => Promise<T>): Promise<T> => {
          try {
            const result = await fn(client);
            lifecycle.push("release");
            return result;
          } catch (error) {
            lifecycle.push("rollback:start");
            await new Promise((resolve) => setTimeout(resolve, 30));
            lifecycle.push("rollback:end");
            throw error;
          }
        },
      };

      const savepointPromise = adapter.savepoint(
        client,
        async () => {
          lifecycle.push("callback:start");
          await new Promise<never>(() => undefined);
        },
        undefined,
        controller.signal,
      );
      let settled = false;
      void savepointPromise
        .finally(() => {
          settled = true;
        })
        .catch(() => undefined);

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(timeout);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(settled).toBe(false);
      expect(lifecycle).toEqual(["callback:start", "rollback:start"]);

      await expect(savepointPromise).rejects.toBe(timeout);
      expect(lifecycle).toEqual(["callback:start", "rollback:start", "rollback:end"]);
    });

    it("should fail fast when nested transaction client does not support savepoint", async () => {
      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;

      const client: MockTx = { id: "existing-tx" };
      const runQuery = vi.fn(async (tx: MockTx) => tx.id);

      await expect(adapter.savepoint(client, runQuery)).rejects.toThrow(
        SavepointUnsupportedProblem,
      );
      expect(runQuery).not.toHaveBeenCalled();
    });
  });
});

describe("RlsTxAdapter", () => {
  function createMockRlsDrizzleDb() {
    const execute = vi.fn(async (_query: unknown): Promise<void> => undefined);
    const transactionFn = async <T>(fn: (tx: MockRlsTx) => Promise<T>): Promise<T> => {
      const tx: MockRlsTx = {
        id: "drizzle-rls-tx",
        execute,
      };

      return fn(tx);
    };

    return {
      execute,
      transaction: vi.fn(transactionFn) as typeof transactionFn,
    };
  }

  function createMockRlsDrizzleDbWithoutExecute() {
    const transactionFn = async <T>(fn: (tx: MockTx) => Promise<T>): Promise<T> => {
      const tx: MockTx = { id: "drizzle-rls-no-execute-tx" };
      return fn(tx);
    };

    return {
      transaction: vi.fn(transactionFn) as typeof transactionFn,
    };
  }

  describe("transaction", () => {
    it("should throw an error when tenant id is null", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => null),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider);
      const runQuery = vi.fn(async () => "result");

      await expect(adapter.transaction(runQuery)).rejects.toThrow("Tenant context is required");
      expect(tenantProvider.getTenantId).toHaveBeenCalledTimes(1);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(db.execute).not.toHaveBeenCalled();
      expect(runQuery).not.toHaveBeenCalled();
    });

    it("should set RLS when tenant id exists", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider);
      const runQuery = vi.fn(async (tx: MockRlsTx) => {
        expect(tx.id).toBe("drizzle-rls-tx");
        return "result";
      });

      const result = await adapter.transaction(runQuery);

      expect(result).toBe("result");
      expect(tenantProvider.getTenantId).toHaveBeenCalledTimes(1);
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(runQuery).toHaveBeenCalledTimes(1);
      const query = db.execute.mock.calls[0]?.[0] as SQL;
      expect(new PgDialect().sqlToQuery(query)).toEqual({
        sql: "select set_config($1, $2, true)",
        params: ["app.current_tenant", "tenant-123"],
        typings: ["none", "none"],
      });
    });

    it("should parameterize custom config keys and tenant ids", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-'quoted"),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider, {
        configKey: "app.current_workspace",
      });

      await adapter.transaction(async () => "result");

      const query = db.execute.mock.calls[0]?.[0] as SQL;
      expect(new PgDialect().sqlToQuery(query)).toEqual({
        sql: "select set_config($1, $2, true)",
        params: ["app.current_workspace", "tenant-'quoted"],
        typings: ["none", "none"],
      });
    });

    it.each(["", "app", "app.current.tenant", "app-current.tenant", '"app".tenant'])(
      "should reject invalid config key %j before transaction setup",
      (configKey) => {
        const db = createMockRlsDrizzleDb();
        const tenantProvider = {
          getTenantId: vi.fn((): string | null => "tenant-123"),
        };

        expect(() => createRlsTxAdapter(db, tenantProvider, { configKey })).toThrow(
          RlsConfigurationProblem,
        );
        expect(tenantProvider.getTenantId).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
        expect(db.execute).not.toHaveBeenCalled();
      },
    );

    it("should fail fast when transaction client does not support execute", async () => {
      const dbWithoutExecute = createMockRlsDrizzleDbWithoutExecute();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const adapter = createRlsTxAdapter(
        dbWithoutExecute as unknown as Parameters<typeof createRlsTxAdapter>[0],
        tenantProvider,
      );
      const runQuery = vi.fn(async () => "result");

      await expect(adapter.transaction(runQuery)).rejects.toThrow(RlsExecuteUnsupportedProblem);
      expect(tenantProvider.getTenantId).toHaveBeenCalledTimes(1);
      expect(dbWithoutExecute.transaction).toHaveBeenCalledTimes(1);
      expect(runQuery).not.toHaveBeenCalled();
    });
  });

  describe("savepoint", () => {
    it("should propagate savepoint support failures from base adapter", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider) as TxAdapter<MockTx>;
      const client: MockTx = { id: "rls-client" };
      const runQuery = vi.fn(async (tx: MockTx) => tx.id);

      await expect(adapter.savepoint(client, runQuery)).rejects.toThrow(
        SavepointUnsupportedProblem,
      );
      expect(runQuery).not.toHaveBeenCalled();
    });
  });
});
