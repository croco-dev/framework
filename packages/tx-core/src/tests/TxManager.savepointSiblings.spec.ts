import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetachedTransactionOperationProblem, TxManager } from "../index";
import type { TxAdapter } from "../index";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  const events: string[] = [];
  const committed: string[] = [];
  const adapter: TxAdapter<{ rows: string[] }> = {
    transaction: async (operation) => {
      const client = { rows: [] as string[] };
      const result = await operation(client);
      committed.push(...client.rows);
      return result;
    },
    savepoint: vi.fn(async (client, operation, _options, signal) => {
      const index = events.filter((event) => event.startsWith("begin")).length + 1;
      events.push(`begin:${index}`);
      const child = { rows: [...client.rows] };
      try {
        const result = await operation(child);
        if (signal?.aborted) throw signal.reason;
        client.rows = child.rows;
        events.push(`release:${index}`);
        return result;
      } catch (error) {
        events.push(`rollback:${index}`);
        throw error;
      }
    }),
    supportsSavepoint: () => true,
  };
  return {
    adapter,
    events,
    committed,
    manager: new TxManager(adapter, { defaultNesting: "savepoint" }),
  };
}

describe("TxManager savepoint siblings", () => {
  beforeEach(() => Container.reset());

  it("serializes concurrent sibling savepoints in invocation order", async () => {
    const { manager, events, committed } = fixture();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const root = manager.run(async () => {
      const first = manager.run(async () => {
        manager.getClient()?.rows.push("first");
        firstStarted.resolve();
        await releaseFirst.promise;
      });
      const second = manager.run(async () => {
        manager.getClient()?.rows.push("second");
      });
      await Promise.all([first, second]);
    });
    await firstStarted.promise;
    const eventsWhileFirstPending = [...events];
    releaseFirst.resolve();
    await root;
    expect(eventsWhileFirstPending).toEqual(["begin:1"]);
    expect(events).toEqual(["begin:1", "release:1", "begin:2", "release:2"]);
    expect(committed).toEqual(["first", "second"]);
  });

  it("allows a savepoint callback to await its own nested savepoint", async () => {
    const { manager, events, committed } = fixture();
    await manager.run(() =>
      manager.run(async () => {
        manager.getClient()?.rows.push("outer");
        await manager.run(async () => {
          manager.getClient()?.rows.push("inner");
        });
        manager.getClient()?.rows.push("outer-after-inner");
      }),
    );
    expect(events).toEqual(["begin:1", "begin:2", "release:2", "release:1"]);
    expect(committed).toEqual(["outer", "inner", "outer-after-inner"]);
  });

  it("queues a joined child's savepoint behind its parent's active savepoint", async () => {
    const { manager, events, committed } = fixture();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const root = manager.run(async () => {
      const first = manager.run(async () => {
        manager.getClient()?.rows.push("first");
        firstStarted.resolve();
        await releaseFirst.promise;
      });
      const joined = manager.run(
        () =>
          manager.run(async () => {
            manager.getClient()?.rows.push("joined-savepoint");
          }),
        { nesting: "join" },
      );
      await Promise.all([first, joined]);
    });
    await firstStarted.promise;
    const eventsWhileFirstPending = [...events];
    releaseFirst.resolve();
    await root;
    expect(eventsWhileFirstPending).toEqual(["begin:1"]);
    expect(events).toEqual(["begin:1", "release:1", "begin:2", "release:2"]);
    expect(committed).toEqual(["first", "joined-savepoint"]);
  });

  it("rolls back the failed sibling and admits the next sibling", async () => {
    const { manager, events, committed } = fixture();
    const started = deferred();
    const release = deferred();
    const failure = new Error("first sibling failed");
    const root = manager.run(async () => {
      manager.getClient()?.rows.push("parent");
      const first = manager.run(async () => {
        manager.getClient()?.rows.push("discarded");
        started.resolve();
        await release.promise;
        throw failure;
      });
      const second = manager.run(async () => {
        expect(manager.getClient()?.rows).toEqual(["parent"]);
        manager.getClient()?.rows.push("survivor");
      });
      const results = await Promise.allSettled([first, second]);
      expect(results).toEqual([
        { status: "rejected", reason: failure },
        { status: "fulfilled", value: undefined },
      ]);
    });
    await started.promise;
    release.resolve();
    await root;
    expect(events).toEqual(["begin:1", "rollback:1", "begin:2", "release:2"]);
    expect(committed).toEqual(["parent", "survivor"]);
  });

  it("rejects a queued sibling after its parent callback ends without opening its savepoint", async () => {
    const { manager, adapter, committed } = fixture();
    const started = deferred();
    const release = deferred();
    const queuedCallback = vi.fn(async () => undefined);
    let children: Promise<PromiseSettledResult<void>[]> | undefined;
    const root = manager.run(async () => {
      const first = manager.run(async () => {
        started.resolve();
        await release.promise;
      });
      const queued = manager.run(queuedCallback);
      children = Promise.allSettled([first, queued]);
      await started.promise;
    });
    await expect(root).rejects.toBeInstanceOf(DetachedTransactionOperationProblem);
    release.resolve();
    const results = await children;
    expect(results?.[1]).toMatchObject({
      status: "rejected",
      reason: expect.any(DetachedTransactionOperationProblem),
    });
    expect(adapter.savepoint).toHaveBeenCalledTimes(1);
    expect(queuedCallback).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });

  it("starts a sibling timeout only after the savepoint is admitted", async () => {
    vi.useFakeTimers();
    try {
      const { manager, events, committed } = fixture();
      const started = deferred();
      const release = deferred();
      const root = manager.run(async () => {
        const first = manager.run(async () => {
          started.resolve();
          await release.promise;
        });
        const second = manager.run(
          async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
            manager.getClient()?.rows.push("completed");
          },
          { timeout: 10 },
        );
        await Promise.all([first, second]);
      });
      await started.promise;
      await vi.advanceTimersByTimeAsync(100);
      const eventsWhileWaiting = [...events];
      release.resolve();
      await vi.advanceTimersByTimeAsync(5);
      await root;
      expect(eventsWhileWaiting).toEqual(["begin:1"]);
      expect(committed).toEqual(["completed"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
