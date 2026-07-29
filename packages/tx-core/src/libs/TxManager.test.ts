import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AfterCommitRegistrationClosedProblem,
  TransactionContextProblem,
  TransactionOutcomeContextProblem,
} from "./problems/TransactionProblems";
import type { TxAdapter } from "./TxAdapter";
import { TxManager } from "./TxManager";

function createMockAdapter(): TxAdapter<{ id: string }> {
  return {
    async transaction<T>(fn: (client: { id: string }) => Promise<T>): Promise<T> {
      const client = { id: "mock-client" };
      return fn(client);
    },
    async savepoint<T>(
      client: { id: string },
      fn: (client: { id: string }) => Promise<T>,
    ): Promise<T> {
      return fn(client);
    },
    supportsSavepoint(): boolean {
      return true;
    },
  };
}

describe("TxManager.onAfterCommit", () => {
  let txManager: TxManager<{ id: string }>;

  beforeEach(() => {
    txManager = new TxManager(createMockAdapter());
  });

  it("should execute hooks after successful commit", async () => {
    const hookFn = vi.fn();

    await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(hookFn);
      return "result";
    });

    expect(hookFn).toHaveBeenCalledTimes(1);
  });

  it("should execute multiple hooks in order", async () => {
    const order: number[] = [];

    await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => {
        order.push(1);
      });
      txManager.onAfterCommit(() => {
        order.push(2);
      });
      txManager.onAfterCommit(() => {
        order.push(3);
      });
      return "result";
    });

    expect(order).toEqual([1, 2, 3]);
  });

  it("should not execute hooks on rollback", async () => {
    const hookFn = vi.fn();

    await expect(
      txManager.runWithOutcome(async () => {
        txManager.onAfterCommit(hookFn);
        throw new Error("Rollback!");
      }),
    ).rejects.toThrow("Rollback!");

    expect(hookFn).not.toHaveBeenCalled();
  });

  it("should share hooks in nested join transactions", async () => {
    const hooks: string[] = [];

    await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => {
        hooks.push("outer");
      });

      await txManager.run(
        async () => {
          txManager.onAfterCommit(() => {
            hooks.push("inner");
          });
        },
        { nesting: "join" },
      );

      return "result";
    });

    expect(hooks).toEqual(["outer", "inner"]);
  });

  it("should reject hook registration before run can discard its outcome", async () => {
    const hook = vi.fn();

    await expect(
      txManager.run(async () => {
        txManager.onAfterCommit(hook);
        return "result";
      }),
    ).rejects.toMatchObject({
      code: "tx-core/after-commit-outcome-required",
    });
    expect(hook).not.toHaveBeenCalled();
  });

  it("should return degraded evidence with every hook failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => {
        throw new TypeError("first failure");
      });
      txManager.onAfterCommit(() => {
        throw new Error("second failure");
      });
      return "result";
    });

    expect(outcome).toMatchObject({
      status: "committed",
      value: "result",
      afterCommit: {
        status: "failed",
        hookCount: 2,
        failures: [
          {
            phase: "hook",
            hookIndex: 0,
            name: "TypeError",
            message: "first failure",
          },
          {
            phase: "hook",
            hookIndex: 1,
            name: "Error",
            message: "second failure",
          },
        ],
        problem: {
          code: "tx-core/after-commit-hooks-failed",
          extensions: {
            committed: true,
            failureCount: 2,
            reportingFailureCount: 0,
          },
        },
      },
    });
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it("should retain stable codes and aggregate causes for multiple failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => {
        throw new TransactionContextProblem();
      });
      txManager.onAfterCommit(() => {
        throw new TransactionOutcomeContextProblem();
      });
      return "result";
    });

    expect(outcome.afterCommit).toMatchObject({
      status: "failed",
      failures: [
        { hookIndex: 0, code: "tx-core/missing-transaction-context" },
        { hookIndex: 1, code: "tx-core/outcome-requires-root" },
      ],
      problem: {
        cause: {
          name: "AfterCommitFailureAggregateError",
          errors: [
            expect.any(TransactionContextProblem),
            expect.any(TransactionOutcomeContextProblem),
          ],
        },
      },
    });
    consoleSpy.mockRestore();
  });

  it("should contain hostile thrown values and logger failures after commit", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("logger unavailable");
    });
    const hostileValue = {
      toString() {
        throw new Error("string conversion failed");
      },
    };

    const outcome = await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => {
        throw hostileValue;
      });
      return "result";
    });

    expect(outcome).toMatchObject({
      status: "committed",
      value: "result",
      afterCommit: {
        status: "failed",
        failures: [
          {
            phase: "hook",
            hookIndex: 0,
            name: "Error",
            message: "Unknown afterCommit failure",
          },
          {
            phase: "reporting",
            hookIndex: 0,
            name: "Error",
            message: "logger unavailable",
          },
        ],
        problem: {
          extensions: {
            committed: true,
            failureCount: 1,
            reportingFailureCount: 1,
          },
        },
      },
    });
    consoleSpy.mockRestore();
  });

  it("should return committed success evidence when every hook succeeds", async () => {
    const outcome = await txManager.runWithOutcome(async () => {
      txManager.onAfterCommit(() => undefined);
      return "result";
    });

    expect(outcome).toEqual({
      status: "committed",
      value: "result",
      afterCommit: {
        status: "succeeded",
        hookCount: 1,
      },
    });
  });

  it("should reject detached hook registration after the transaction callback closes", async () => {
    let releaseDetached!: () => void;
    const detachedGate = new Promise<void>((resolve) => {
      releaseDetached = resolve;
    });
    let detachedRegistration!: Promise<void>;

    const outcome = await txManager.runWithOutcome(async () => {
      expect(txManager.canRegisterAfterCommit()).toBe(true);
      detachedRegistration = detachedGate.then(() => {
        expect(txManager.isInTransaction()).toBe(false);
        expect(txManager.getClient()).toBeNull();
        expect(txManager.canRegisterAfterCommit()).toBe(false);
        txManager.onAfterCommit(() => undefined);
      });
      return "result";
    });

    releaseDetached();

    expect(txManager.isInTransaction()).toBe(false);
    expect(txManager.getClient()).toBeNull();
    await expect(detachedRegistration).rejects.toBeInstanceOf(AfterCommitRegistrationClosedProblem);
    expect(outcome.afterCommit).toEqual({ status: "succeeded", hookCount: 0 });
  });

  it.each([
    ["join", undefined],
    ["savepoint", { nesting: "savepoint" as const }],
  ])(
    "should doom the root when a late %s starts from a closed parent context",
    async (_nesting, options) => {
      let releaseLateRun!: () => void;
      const lateRunGate = new Promise<void>((resolve) => {
        releaseLateRun = resolve;
      });
      let lateRun!: Promise<string>;

      await expect(
        txManager.runWithOutcome(async () => {
          await txManager.run(
            async () => {
              lateRun = lateRunGate.then(() => txManager.run(async () => "late", options));
              return "parent";
            },
            { nesting: "savepoint" },
          );

          releaseLateRun();
          await expect(lateRun).rejects.toMatchObject({
            code: "tx-core/detached-transaction-operation",
          });
          return "root";
        }),
      ).rejects.toMatchObject({
        code: "tx-core/detached-transaction-operation",
      });
    },
  );

  it("should reject the root before commit when a detached savepoint is still active", async () => {
    let releaseSavepoint!: () => void;
    const savepointGate = new Promise<void>((resolve) => {
      releaseSavepoint = resolve;
    });
    const hook = vi.fn();
    let detachedSavepoint!: Promise<string>;

    await expect(
      txManager.runWithOutcome(async () => {
        detachedSavepoint = txManager.run(
          async () => {
            txManager.onAfterCommit(hook);
            await savepointGate;
            return "nested";
          },
          { nesting: "savepoint" },
        );
        return "root";
      }),
    ).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
      detail: "Transaction callback completed with 1 detached nested operation(s)",
    });

    releaseSavepoint();

    await expect(detachedSavepoint).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });
    expect(hook).not.toHaveBeenCalled();
  });

  it("should reject the root before commit when a detached join is still active", async () => {
    let releaseJoin!: () => void;
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let detachedJoin!: Promise<string>;

    await expect(
      txManager.runWithOutcome(async () => {
        detachedJoin = txManager.run(async () => {
          await joinGate;
          return "joined";
        });
        return "root";
      }),
    ).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });

    releaseJoin();

    await expect(detachedJoin).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });
  });

  it("should track detached savepoint fallbacks as joined operations", async () => {
    const unsupportedAdapter = createMockAdapter();
    unsupportedAdapter.supportsSavepoint = () => false;
    const unsupportedTxManager = new TxManager(unsupportedAdapter);
    let releaseFallback!: () => void;
    const fallbackGate = new Promise<void>((resolve) => {
      releaseFallback = resolve;
    });
    let detachedFallback!: Promise<string>;

    await expect(
      unsupportedTxManager.runWithOutcome(async () => {
        detachedFallback = unsupportedTxManager.run(
          async () => {
            await fallbackGate;
            return "fallback";
          },
          { nesting: "savepoint" },
        );
        return "root";
      }),
    ).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });

    releaseFallback();

    await expect(detachedFallback).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });
  });

  it("should keep a detached descendant failure sticky until the root boundary", async () => {
    let releaseChild!: () => void;
    const childGate = new Promise<void>((resolve) => {
      releaseChild = resolve;
    });
    const hook = vi.fn();
    let detachedChild!: Promise<string>;

    await expect(
      txManager.runWithOutcome(async () => {
        await txManager
          .run(
            async () => {
              detachedChild = txManager.run(
                async () => {
                  txManager.onAfterCommit(hook);
                  await childGate;
                  return "child";
                },
                { nesting: "savepoint" },
              );
              return "parent";
            },
            { nesting: "savepoint" },
          )
          .catch((error: unknown) => {
            expect(error).toMatchObject({
              code: "tx-core/detached-transaction-operation",
            });
          });

        releaseChild();
        await expect(detachedChild).rejects.toMatchObject({
          code: "tx-core/detached-transaction-operation",
        });
        return "root";
      }),
    ).rejects.toMatchObject({
      code: "tx-core/detached-transaction-operation",
    });
    expect(hook).not.toHaveBeenCalled();
  });

  it("should reject runWithOutcome when the transaction does not commit", async () => {
    const hook = vi.fn();

    await expect(
      txManager.runWithOutcome(async () => {
        txManager.onAfterCommit(hook);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(hook).not.toHaveBeenCalled();
  });

  it("should throw when called outside transaction", () => {
    expect(() => txManager.onAfterCommit(() => {})).toThrow();
  });
});
