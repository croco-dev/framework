import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import { TransactionRollbackConfirmedProblem } from "@croco/tx-core";
import type { TxAdapter } from "@croco/tx-core";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  createDrizzleTxAdapter,
  createRlsTxAdapter,
  RlsConfigurationProblem,
  RlsDebugLoggingProblem,
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

      await expect(transactionPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      await expect(transactionPromise).rejects.toMatchObject({
        name: TransactionRollbackConfirmedProblem.name,
        cause: timeout,
        extensions: { committed: false },
      });
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

      await expect(transactionPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      await expect(transactionPromise).rejects.toMatchObject({
        name: TransactionRollbackConfirmedProblem.name,
        cause: timeout,
        extensions: { committed: false },
      });
      expect(lifecycle).toEqual(["callback:start", "rollback:start", "rollback:end"]);
    });

    it("should preserve a committed result when the deadline expires during commit response", async () => {
      const lifecycle: string[] = [];
      const transaction = async <T>(fn: (tx: MockTx) => Promise<T>): Promise<T> => {
        const result = await fn({ id: "drizzle-tx" });
        lifecycle.push("commit");
        await new Promise((resolve) => setTimeout(resolve, 30));
        lifecycle.push("response");
        return result;
      };
      const db: MockDrizzleDb<MockTx> = {
        transaction: vi.fn(transaction) as typeof transaction,
      };
      const adapter = createDrizzleTxAdapter(db) as TxAdapter<MockTx>;
      const controller = new AbortController();

      const transactionPromise = adapter.transaction(
        async () => "committed",
        undefined,
        controller.signal,
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(new Error("Transaction timed out after 5ms"));

      await expect(transactionPromise).resolves.toBe("committed");
      expect(lifecycle).toEqual(["commit", "response"]);
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

      await expect(transactionPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      await expect(transactionPromise).rejects.toMatchObject({
        name: TransactionRollbackConfirmedProblem.name,
        cause: timeout,
        extensions: { committed: false },
      });
      await expect(postAbortProbe).resolves.toBeUndefined();
      expect(execute).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
    });

    it("should wait for in-flight query to settle before executing rollback on abort", async () => {
      let inFlight = false;
      const events: string[] = [];

      const execute = vi.fn(async (query: string) => {
        events.push(`query:start:${query}`);
        inFlight = true;
        await new Promise((resolve) => setTimeout(resolve, 40));
        inFlight = false;
        events.push(`query:end:${query}`);
        return "query-result";
      });

      const db = {
        transaction: async <T>(
          fn: (tx: { id: string; execute: typeof execute }) => Promise<T>,
        ): Promise<T> => {
          const client = { id: "tx-client", execute };
          try {
            const result = await fn(client);
            events.push("commit");
            return result;
          } catch (error) {
            events.push("rollback:start");
            if (inFlight) {
              events.push("conflict:query_in_progress");
              throw new Error("cannot run query while another is in progress");
            }
            events.push("rollback:end");
            throw error;
          }
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out after 10ms");

      const promise = adapter.transaction(
        async (tx: any) => {
          await tx.execute("SELECT pg_sleep(1)");
          return "done";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(events).not.toContain("conflict:query_in_progress");
      expect(events).toEqual([
        "query:start:SELECT pg_sleep(1)",
        "query:end:SELECT pg_sleep(1)",
        "rollback:start",
        "rollback:end",
      ]);
    });

    it("should discard aborted client from connection pool on release", async () => {
      let releasedWithDiscard = false;
      let releasedNormally = false;

      const execute = vi.fn(async (_query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return "query-result";
      });

      const rawConnection = {
        id: "pool-conn-1",
        execute,
        release: (err?: unknown) => {
          if (err) {
            releasedWithDiscard = true;
          } else {
            releasedNormally = true;
          }
        },
      };

      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = {
            session: { client: rawConnection },
            execute: (q: string) => rawConnection.execute(q),
          };
          try {
            return await fn(tx);
          } finally {
            rawConnection.release();
          }
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out");

      const promise = adapter.transaction(
        async (tx: any) => {
          await tx.execute("SELECT pg_sleep(1)");
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      try {
        await promise;
      } catch {
        // ignore
      }

      expect(releasedNormally).toBe(false);
      expect(releasedWithDiscard).toBe(true);
    });

    it("should invoke onConnectionInvalidate hook when provided", async () => {
      const invalidatedClients: unknown[] = [];
      const reasons: Error[] = [];

      const execute = vi.fn(async (_query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return "query-result";
      });

      const rawConnection = { id: "raw-conn", execute };
      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          return fn({ session: { client: rawConnection }, execute });
        },
      };

      const onConnectionInvalidate = vi.fn((client: unknown, reason: Error) => {
        invalidatedClients.push(client);
        reasons.push(reason);
      });

      const adapter = createDrizzleTxAdapter(db as any, { onConnectionInvalidate });
      const controller = new AbortController();
      const timeout = new Error("Transaction timed out");

      const promise = adapter.transaction(
        async (tx: any) => {
          await tx.execute("SELECT 1");
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      try {
        await promise;
      } catch {
        // ignore
      }

      expect(onConnectionInvalidate).toHaveBeenCalledTimes(1);
      expect(invalidatedClients[0]).toBe(rawConnection);
      expect(reasons[0]).toBe(timeout);
    });

    it("should discard reused connection from pool if a subsequent transaction times out", async () => {
      const releaseCalls: unknown[] = [];
      const execute = vi.fn(async (_query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return "ok";
      });

      const rawConnection = {
        id: "pooled-conn",
        execute,
        release: (err?: unknown) => {
          releaseCalls.push(err ?? null);
        },
      };

      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = { session: { client: rawConnection }, execute: rawConnection.execute };
          try {
            return await fn(tx);
          } finally {
            rawConnection.release();
          }
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);

      // Tx 1: Succeeds normally on rawConnection
      await adapter.transaction(async (tx: any) => {
        await tx.execute("SELECT 1");
      });
      expect(releaseCalls).toEqual([null]);

      // Tx 2: Times out on the SAME reused rawConnection
      const controller = new AbortController();
      const timeout = new Error("Tx 2 timeout");
      const tx2Promise = adapter.transaction(
        async (tx: any) => {
          await tx.execute("SELECT 2");
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      await expect(tx2Promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      // Tx 2 must have called release with the taint error!
      expect(releaseCalls.length).toBe(2);
      expect(releaseCalls[1]).toBe(timeout);
    });

    it("should prevent unhandled promise rejections when an in-flight query rejects after abort", async () => {
      const unhandledErrors: unknown[] = [];
      const unhandledListener = (reason: unknown) => {
        unhandledErrors.push(reason);
      };
      process.on("unhandledRejection", unhandledListener);

      try {
        const queryError = new Error("Query failed at socket level after abort");
        const execute = vi.fn(async (_query: string) => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          throw queryError;
        });

        const db = {
          transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
            const tx = { execute };
            return fn(tx);
          },
        };

        const adapter = createDrizzleTxAdapter(db as any);
        const controller = new AbortController();
        const timeout = new Error("Transaction timed out");

        const promise = adapter.transaction(
          async (tx: any) => {
            await tx.execute("SELECT pg_sleep(1)");
          },
          undefined,
          controller.signal,
        );

        await new Promise((resolve) => setTimeout(resolve, 10));
        controller.abort(timeout);

        await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
        // Wait longer than the 40ms query execution time to allow any unhandled rejection to occur
        await new Promise((resolve) => setTimeout(resolve, 60));

        expect(unhandledErrors).toEqual([]);
      } finally {
        process.removeListener("unhandledRejection", unhandledListener);
      }
    });

    it("should force taint connection and invoke invalidation when operations fail to drain within timeout", async () => {
      const onConnectionInvalidate = vi.fn();
      const socketDestroyed = vi.fn();

      const rawConnection = {
        id: "hung-conn",
        destroy: socketDestroyed,
      };

      let releaseArg: unknown = undefined;
      const clientWithRelease = {
        ...rawConnection,
        release: (err?: unknown) => {
          releaseArg = err;
        },
      };

      const execute = vi.fn(() => new Promise(() => undefined));

      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = { session: { client: clientWithRelease }, execute };
          try {
            return await fn(tx);
          } finally {
            clientWithRelease.release();
          }
        },
      };

      const adapter = createDrizzleTxAdapter(db as any, {
        onConnectionInvalidate,
        operationDrainTimeoutMs: 30,
      });

      const controller = new AbortController();
      const timeout = new Error("Tx hung timeout");

      const promise = adapter.transaction(
        async (tx: any) => {
          await tx.execute();
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(onConnectionInvalidate).toHaveBeenCalledWith(clientWithRelease, timeout);
      expect(socketDestroyed).toHaveBeenCalled();
      expect(releaseArg).toBe(timeout);
    });

    it("should wait for un-awaited in-flight queries before executing rollback on early callback return", async () => {
      let inFlight = false;
      const events: string[] = [];

      const execute = vi.fn(async (query: string) => {
        events.push(`query:start:${query}`);
        inFlight = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        inFlight = false;
        events.push(`query:end:${query}`);
        return "query-result";
      });

      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          const client = { execute };
          try {
            return await fn(client);
          } catch (error) {
            events.push("rollback:start");
            if (inFlight) {
              events.push("conflict:query_in_progress");
            }
            events.push("rollback:end");
            throw error;
          }
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();

      const promise = adapter.transaction(
        async (tx: any) => {
          void tx.execute("slow-background-query");
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "early-return";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 5));
      controller.abort(new Error("Timeout at 5ms"));

      await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(events).not.toContain("conflict:query_in_progress");
      expect(events).toEqual([
        "query:start:slow-background-query",
        "query:end:slow-background-query",
        "rollback:start",
        "rollback:end",
      ]);
    });

    it("should preserve native Buffer, Uint8Array, and private class properties on query results", async () => {
      class CustomModel {
        #secret = "private-field-value";
        get secret(): string {
          return this.#secret;
        }
      }

      const rawBuffer = Buffer.from("croco-binary-data");
      const rawUint8 = new Uint8Array([1, 2, 3, 4]);
      const rawModel = new CustomModel();

      const execute = vi.fn(async () => [
        {
          buffer: rawBuffer,
          uint8: rawUint8,
          model: rawModel,
        },
      ]);

      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          return fn({ execute });
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();

      const result = await adapter.transaction(
        async (tx: any) => {
          return await tx.execute();
        },
        undefined,
        controller.signal,
      );

      expect(result[0].buffer.byteLength).toBe(rawBuffer.byteLength);
      expect(result[0].buffer.toString()).toBe("croco-binary-data");
      expect(result[0].uint8.byteLength).toBe(4);
      expect(result[0].model.secret).toBe("private-field-value");
    });

    it("should preserve and throw the actual rollback error when rollback execution fails", async () => {
      const rollbackFailure = new Error("Database connection severed during rollback");
      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          try {
            await fn({ execute: vi.fn(async () => undefined) });
          } catch {
            throw rollbackFailure;
          }
          return undefined as T;
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();

      const promise = adapter.transaction(
        async () => {
          await new Promise((r) => setTimeout(r, 30));
        },
        undefined,
        controller.signal,
      );

      await new Promise((r) => setTimeout(r, 5));
      controller.abort(new Error("Timeout abort"));

      await expect(promise).rejects.toThrow(rollbackFailure);
    });

    it("should handle asynchronous rejections in onConnectionInvalidate hook without unhandled rejection", async () => {
      const unhandledErrors: unknown[] = [];
      const unhandledListener = (reason: unknown) => {
        unhandledErrors.push(reason);
      };
      process.on("unhandledRejection", unhandledListener);

      try {
        const hookError = new Error("Async hook failure");
        const onConnectionInvalidate = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw hookError;
        });

        const db = {
          transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
            return fn({ session: { client: { id: "conn" } }, execute: vi.fn() });
          },
        };

        const adapter = createDrizzleTxAdapter(db as any, { onConnectionInvalidate });
        const controller = new AbortController();

        const promise = adapter.transaction(
          async () => {
            await new Promise((r) => setTimeout(r, 30));
          },
          undefined,
          controller.signal,
        );

        await new Promise((r) => setTimeout(r, 5));
        controller.abort(new Error("Timeout abort"));

        await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);

        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(unhandledErrors).toEqual([]);
      } finally {
        process.removeListener("unhandledRejection", unhandledListener);
      }
    });

    it("should confirm rollback when aborted with non-Error primitive reason", async () => {
      const db = {
        transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          return fn({ session: { client: { id: "conn" } }, execute: vi.fn() });
        },
      };

      const adapter = createDrizzleTxAdapter(db as any);
      const controller = new AbortController();

      const promise = adapter.transaction(
        async () => {
          await new Promise((r) => setTimeout(r, 30));
        },
        undefined,
        controller.signal,
      );

      await new Promise((r) => setTimeout(r, 5));
      controller.abort("custom-cancellation-string");

      await expect(promise).rejects.toThrow(TransactionRollbackConfirmedProblem);
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

      await expect(savepointPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      await expect(savepointPromise).rejects.toMatchObject({
        name: TransactionRollbackConfirmedProblem.name,
        cause: timeout,
        extensions: { committed: false },
      });
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

      await expect(savepointPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      await expect(savepointPromise).rejects.toMatchObject({
        name: TransactionRollbackConfirmedProblem.name,
        cause: timeout,
        extensions: { committed: false },
      });
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

    it("should wait for in-flight savepoint query before executing rollback to savepoint on abort", async () => {
      let inFlight = false;
      const events: string[] = [];

      const execute = vi.fn(async (query: string) => {
        events.push(`query:start:${query}`);
        inFlight = true;
        await new Promise((resolve) => setTimeout(resolve, 40));
        inFlight = false;
        events.push(`query:end:${query}`);
        return "query-result";
      });

      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);
      const parentClient = {
        id: "parent-tx",
        execute,
        transaction: async <T>(fn: (nestedTx: any) => Promise<T>): Promise<T> => {
          const nestedClient = { id: "savepoint-tx", execute };
          events.push("savepoint:start");
          try {
            const res = await fn(nestedClient);
            events.push("savepoint:release");
            return res;
          } catch (err) {
            events.push("savepoint:rollback:start");
            if (inFlight) {
              events.push("conflict:savepoint_rollback_while_query_in_progress");
              throw new Error("cannot run query while another is in progress");
            }
            events.push("savepoint:rollback:end");
            throw err;
          }
        },
      };

      const controller = new AbortController();
      const timeout = new Error("Savepoint timed out after 10ms");

      const savepointPromise = adapter.savepoint(
        parentClient as any,
        async (tx: any) => {
          await tx.execute("SELECT pg_sleep(1)");
          return "nested-done";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(timeout);

      await expect(savepointPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(events).not.toContain("conflict:savepoint_rollback_while_query_in_progress");
      expect(events).toEqual([
        "savepoint:start",
        "query:start:SELECT pg_sleep(1)",
        "query:end:SELECT pg_sleep(1)",
        "savepoint:rollback:start",
        "savepoint:rollback:end",
      ]);
    });

    it("should allow parent transaction to execute subsequent queries cleanly after savepoint timeout", async () => {
      let socketInUse = false;
      const queryLog: string[] = [];

      const execute = vi.fn(async (query: string) => {
        if (socketInUse) {
          throw new Error(`cannot run ${query} while another is in progress`);
        }
        socketInUse = true;
        queryLog.push(`start:${query}`);
        await new Promise((resolve) => setTimeout(resolve, query === "slow" ? 40 : 10));
        socketInUse = false;
        queryLog.push(`end:${query}`);
        return `result:${query}`;
      });

      const parentClient = {
        id: "parent-tx",
        execute,
        transaction: async <T>(fn: (nestedTx: any) => Promise<T>): Promise<T> => {
          const nestedClient = { id: "nested-savepoint", execute };
          try {
            return await fn(nestedClient);
          } catch (err) {
            await execute("ROLLBACK TO SAVEPOINT sp1");
            throw err;
          }
        },
      };

      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db);
      const controller = new AbortController();

      const savepointPromise = adapter.savepoint(
        parentClient as any,
        async (tx: any) => {
          await tx.execute("slow");
          return "nested-val";
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(new Error("Timeout in savepoint"));

      await expect(savepointPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);

      // Parent transaction executes subsequent query after savepoint timeout
      const subsequentResult = await parentClient.execute("subsequent-parent-query");
      expect(subsequentResult).toBe("result:subsequent-parent-query");
      expect(queryLog).toEqual([
        "start:slow",
        "end:slow",
        "start:ROLLBACK TO SAVEPOINT sp1",
        "end:ROLLBACK TO SAVEPOINT sp1",
        "start:subsequent-parent-query",
        "end:subsequent-parent-query",
      ]);
    });

    it("should not invalidate parent connection when savepoint times out cleanly", async () => {
      const onConnectionInvalidate = vi.fn();
      let parentReleasedWithDiscard = false;
      let parentReleasedNormally = false;

      const execute = vi.fn(async (query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return `result:${query}`;
      });

      const rawConnection = {
        id: "parent-raw-conn",
        execute,
        release: (err?: unknown) => {
          if (err) {
            parentReleasedWithDiscard = true;
          } else {
            parentReleasedNormally = true;
          }
        },
      };

      const parentClient = {
        id: "parent-tx",
        session: { client: rawConnection },
        execute,
        transaction: async <T>(fn: (nestedTx: any) => Promise<T>): Promise<T> => {
          const nestedClient = { id: "savepoint-tx", session: { client: rawConnection }, execute };
          try {
            return await fn(nestedClient);
          } catch (err) {
            await execute("ROLLBACK TO SAVEPOINT sp1");
            throw err;
          }
        },
      };

      const db = createMockDrizzleDb();
      const adapter = createDrizzleTxAdapter(db, { onConnectionInvalidate });
      const controller = new AbortController();

      const savepointPromise = adapter.savepoint(
        parentClient as any,
        async (tx: any) => {
          await tx.execute("savepoint-query");
        },
        undefined,
        controller.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(new Error("Savepoint timeout"));

      await expect(savepointPromise).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(onConnectionInvalidate).not.toHaveBeenCalled();

      rawConnection.release();
      expect(parentReleasedWithDiscard).toBe(false);
      expect(parentReleasedNormally).toBe(true);
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
    it("should emit requested debug logging through an injected logger", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const logger = {
        error: vi.fn(),
        info: vi.fn(),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider, { debug: true, logger });

      await expect(adapter.transaction(async () => "result")).resolves.toBe("result");

      expect(logger.info).toHaveBeenCalledWith(
        "[RlsTxAdapter] Setting app.current_tenant = 'tenant-123'",
      );
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it("should emit requested debug logging through the canonical logger token", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const logger = {
        child: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      };
      Container.set(LOGGER_TOKEN, logger);

      try {
        const adapter = createRlsTxAdapter(db, tenantProvider, { debug: true });
        await expect(adapter.transaction(async () => "result")).resolves.toBe("result");
      } finally {
        Container.remove(LOGGER_TOKEN);
      }

      expect(logger.info).toHaveBeenCalledWith(
        "[RlsTxAdapter] Setting app.current_tenant = 'tenant-123'",
      );
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it("should reject debug mode when logger resolution fails", () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const resolutionFailure = new Error("logger unavailable");
      const getLogger = vi.spyOn(Container, "get").mockImplementation(() => {
        throw resolutionFailure;
      });

      let thrown: unknown;
      try {
        createRlsTxAdapter(db, tenantProvider, { debug: true });
      } catch (cause) {
        thrown = cause;
      } finally {
        getLogger.mockRestore();
      }

      expect(thrown).toBeInstanceOf(RlsDebugLoggingProblem);
      expect(thrown).toMatchObject({
        cause: resolutionFailure,
        code: "tx-drizzle/rls-debug-logging-failed",
        detail: "RLS debug logging failed during initialization",
        extensions: { phase: "initialization", retryable: false },
      });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(db.execute).not.toHaveBeenCalled();
    });

    it("should reject the transaction when requested debug logging fails", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const writeFailure = new Error("logger write failed");
      const logger = {
        error: vi.fn(),
        info: vi.fn(async () => {
          throw writeFailure;
        }),
      };
      const adapter = createRlsTxAdapter(db, tenantProvider, { debug: true, logger });

      await expect(adapter.transaction(async () => "result")).rejects.toMatchObject({
        cause: writeFailure,
        code: "tx-drizzle/rls-debug-logging-failed",
        detail: "RLS debug logging failed during write",
        extensions: { phase: "write", retryable: false },
      });
      expect(db.execute).not.toHaveBeenCalled();
    });

    it("should keep debug-disabled transactions independent of logger availability", async () => {
      const db = createMockRlsDrizzleDb();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const getLogger = vi.spyOn(Container, "get").mockImplementation(() => {
        throw new Error("logger unavailable");
      });

      try {
        const adapter = createRlsTxAdapter(db, tenantProvider, { debug: false });
        await expect(adapter.transaction(async () => "result")).resolves.toBe("result");
      } finally {
        getLogger.mockRestore();
      }

      expect(db.execute).toHaveBeenCalledTimes(1);
    });

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

    it("should preserve the unsupported execute problem when diagnostic logging fails", async () => {
      const dbWithoutExecute = createMockRlsDrizzleDbWithoutExecute();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const loggingFailure = new Error("logger write failed");
      const logger = {
        error: vi.fn(() => {
          throw loggingFailure;
        }),
        info: vi.fn(),
      };
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const adapter = createRlsTxAdapter(
        dbWithoutExecute as unknown as Parameters<typeof createRlsTxAdapter>[0],
        tenantProvider,
        { logger },
      );
      const runQuery = vi.fn(async () => "result");

      try {
        let thrown: unknown;
        try {
          await adapter.transaction(runQuery);
        } catch (cause) {
          thrown = cause;
        }

        expect(thrown).toBeInstanceOf(RlsExecuteUnsupportedProblem);
        expect(thrown).toMatchObject({
          code: "tx-drizzle/rls-execute-unsupported",
          detail:
            "Transaction client does not support execute(), cannot set RLS key 'app.current_tenant'",
        });
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(consoleError).toHaveBeenCalledWith(
          "[RlsTxAdapter] Failed to log unsupported execute problem",
          { loggingFailure, problem: thrown },
        );
        expect(dbWithoutExecute.transaction).toHaveBeenCalledTimes(1);
        expect(runQuery).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });

    it("should check execute support before requested debug logging", async () => {
      const dbWithoutExecute = createMockRlsDrizzleDbWithoutExecute();
      const tenantProvider = {
        getTenantId: vi.fn((): string | null => "tenant-123"),
      };
      const logger = {
        error: vi.fn(),
        info: vi.fn(() => {
          throw new Error("logger write failed");
        }),
      };
      const adapter = createRlsTxAdapter(
        dbWithoutExecute as unknown as Parameters<typeof createRlsTxAdapter>[0],
        tenantProvider,
        { debug: true, logger },
      );
      const runQuery = vi.fn(async () => "result");

      await expect(adapter.transaction(runQuery)).rejects.toBeInstanceOf(
        RlsExecuteUnsupportedProblem,
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();
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
