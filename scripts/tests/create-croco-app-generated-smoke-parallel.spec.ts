import { describe, expect, it } from "vitest";
import {
  BROWSER_RESOURCE_LOCK,
  combineGeneratedSmokeCaseTiming,
  generatedSmokeCaseResourceLocks,
  isTrustedWorkerVerification,
  orderGeneratedSmokeCasesForPool,
  resolveGeneratedSmokeConcurrency,
  runWithResourceLocks,
} from "../create-croco-app-generated-smoke-parallel.mts";

type Item = { readonly name: string; readonly locks: readonly string[] };

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

function startPool(items: readonly Item[], concurrency: number) {
  const running = new Set<string>();
  const started: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  let maxRunning = 0;
  const done = runWithResourceLocks(items, {
    concurrency,
    locksOf: (item) => item.locks,
    run: async (item) => {
      const gate = deferred();
      gates.set(item.name, gate);
      running.add(item.name);
      started.push(item.name);
      maxRunning = Math.max(maxRunning, running.size);
      await gate.promise;
      running.delete(item.name);
    },
  });
  return {
    done,
    running,
    started,
    maxRunning: () => maxRunning,
    finish: async (name: string) => {
      gates.get(name)?.resolve();
      await flush();
    },
  };
}

describe("resolveGeneratedSmokeConcurrency", () => {
  it("uses half of the available parallelism, capped at two workers", () => {
    expect(resolveGeneratedSmokeConcurrency({}, 1)).toBe(1);
    expect(resolveGeneratedSmokeConcurrency({}, 2)).toBe(1);
    expect(resolveGeneratedSmokeConcurrency({}, 4)).toBe(2);
    expect(resolveGeneratedSmokeConcurrency({}, 18)).toBe(2);
  });

  it("honors a positive integer override and ignores invalid values", () => {
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "3" }, 4)).toBe(3);
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "1" }, 18)).toBe(
      1,
    );
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "0" }, 4)).toBe(2);
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "many" }, 4)).toBe(
      2,
    );
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "1.5" }, 4)).toBe(
      2,
    );
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: "3x" }, 4)).toBe(
      2,
    );
    expect(resolveGeneratedSmokeConcurrency({ CROCO_GENERATED_SMOKE_CONCURRENCY: " 3 " }, 4)).toBe(
      3,
    );
  });
});

describe("generatedSmokeCaseResourceLocks", () => {
  it("locks the browser for cases that install browsers or run Playwright journeys", () => {
    expect(
      generatedSmokeCaseResourceLocks([{ args: ["test"] }, { args: ["test:browser:install"] }]),
    ).toEqual([BROWSER_RESOURCE_LOCK]);
    expect(
      generatedSmokeCaseResourceLocks([{ args: ["test:journey", "tests/a.spec.ts"] }]),
    ).toEqual([BROWSER_RESOURCE_LOCK]);
  });

  it("leaves cases without browser steps unlocked", () => {
    expect(
      generatedSmokeCaseResourceLocks([{ args: ["demo:smoke"] }, {}, { args: ["test"] }]),
    ).toEqual([]);
  });
});

describe("orderGeneratedSmokeCasesForPool", () => {
  it("starts locked cases first and keeps the manifest order within each group", () => {
    const items: Item[] = [
      { name: "a", locks: [] },
      { name: "b", locks: ["browser"] },
      { name: "c", locks: [] },
      { name: "d", locks: ["browser"] },
    ];
    expect(
      orderGeneratedSmokeCasesForPool(items, (item) => item.locks).map(({ name }) => name),
    ).toEqual(["b", "d", "a", "c"]);
  });
});

describe("runWithResourceLocks", () => {
  it("never runs more items than the concurrency limit and runs every item once", async () => {
    const pool = startPool(
      ["a", "b", "c", "d"].map((name) => ({ name, locks: [] })),
      2,
    );
    await flush();
    expect(pool.started).toEqual(["a", "b"]);

    await pool.finish("a");
    expect(pool.started).toEqual(["a", "b", "c"]);
    await pool.finish("b");
    await pool.finish("c");
    await pool.finish("d");
    await pool.done;

    expect(pool.started).toEqual(["a", "b", "c", "d"]);
    expect(pool.maxRunning()).toBe(2);
  });

  it("keeps items sharing a lock apart while unlocked items use the free slot", async () => {
    const pool = startPool(
      [
        { name: "browser-1", locks: ["browser"] },
        { name: "browser-2", locks: ["browser"] },
        { name: "plain-1", locks: [] },
        { name: "plain-2", locks: [] },
      ],
      2,
    );
    await flush();
    expect([...pool.running]).toEqual(["browser-1", "plain-1"]);

    await pool.finish("plain-1");
    expect([...pool.running]).toEqual(["browser-1", "plain-2"]);

    await pool.finish("browser-1");
    expect([...pool.running]).toEqual(["plain-2", "browser-2"]);

    await pool.finish("plain-2");
    await pool.finish("browser-2");
    await pool.done;
    expect(pool.started).toEqual(["browser-1", "plain-1", "plain-2", "browser-2"]);
  });

  it("rejects when a run fails instead of dropping the item", async () => {
    await expect(
      runWithResourceLocks([{ name: "a", locks: [] }], {
        concurrency: 2,
        locksOf: (item) => item.locks,
        run: async () => {
          throw new Error("worker crashed");
        },
      }),
    ).rejects.toThrow("worker crashed");
  });

  it("waits for running items and starts no new item before rejecting on a failure", async () => {
    const sibling = deferred();
    const started: string[] = [];
    let siblingSettled = false;
    let poolSettled = false;
    const done = runWithResourceLocks(
      [
        { name: "failing", locks: [] },
        { name: "running", locks: [] },
        { name: "queued", locks: [] },
      ],
      {
        concurrency: 2,
        locksOf: (item) => item.locks,
        run: async (item) => {
          started.push(item.name);
          if (item.name === "failing") throw new Error("result could not be recorded");
          if (item.name === "running") {
            await sibling.promise;
            siblingSettled = true;
          }
        },
      },
    ).finally(() => {
      poolSettled = true;
    });
    const rejection = expect(done).rejects.toThrow("result could not be recorded");

    await flush();
    expect(poolSettled).toBe(false);

    sibling.resolve();
    await rejection;
    expect(siblingSettled).toBe(true);
    expect(started).toEqual(["failing", "running"]);
  });

  it("waits for running items when a callback throws before returning a promise", async () => {
    const sibling = deferred();
    let poolSettled = false;
    const done = runWithResourceLocks(
      [
        { name: "running", locks: [] },
        { name: "throwing", locks: [] },
      ],
      {
        concurrency: 2,
        locksOf: (item) => item.locks,
        run: (item) => {
          if (item.name === "throwing") throw new Error("callback threw synchronously");
          return sibling.promise;
        },
      },
    ).finally(() => {
      poolSettled = true;
    });
    const rejection = expect(done).rejects.toThrow("callback threw synchronously");

    await flush();
    expect(poolSettled).toBe(false);

    sibling.resolve();
    await rejection;
  });
});

describe("isTrustedWorkerVerification", () => {
  it("trusts a passed result only from a worker that exited cleanly", () => {
    expect(isTrustedWorkerVerification({ code: 0, signal: null }, "passed")).toBe(true);
    expect(isTrustedWorkerVerification({ code: null, signal: "SIGKILL" }, "passed")).toBe(false);
    expect(isTrustedWorkerVerification({ code: 1, signal: null }, "passed")).toBe(false);
  });

  it("keeps a failed result from any worker exit", () => {
    expect(isTrustedWorkerVerification({ code: null, signal: "SIGKILL" }, "failed")).toBe(true);
    expect(isTrustedWorkerVerification({ code: 0, signal: null }, "failed")).toBe(true);
  });
});

describe("combineGeneratedSmokeCaseTiming", () => {
  it("adds preparation and verification time without the queue wait between them", () => {
    expect(
      combineGeneratedSmokeCaseTiming(
        { durationMs: 1_000, steps: [{ label: "generate", status: "passed", durationMs: 1_000 }] },
        { durationMs: 5_000, steps: [{ label: "install", status: "passed", durationMs: 5_000 }] },
      ),
    ).toEqual({
      durationMs: 6_000,
      steps: [
        { label: "generate", status: "passed", durationMs: 1_000 },
        { label: "install", status: "passed", durationMs: 5_000 },
      ],
    });
  });
});
