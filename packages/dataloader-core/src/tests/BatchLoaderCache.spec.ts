import { describe, expect, it, vi } from "vitest";
import { createBatchLoader } from "../index";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("BatchLoader cache ownership", () => {
  it.each([
    ["batch", false, false],
    ["key", false, false],
    ["batch", true, false],
    ["key", true, false],
    ["batch", false, true],
    ["key", false, true],
  ] as const)(
    "preserves replacement cache entries after an older %s failure (clear=%s, error=%s)",
    async (failureKind, clear, primeError) => {
      const oldBatch = deferred<readonly (string | Error)[]>();
      const started = deferred<void>();
      const failure = new Error("old batch failed");
      const batchFn = vi.fn(async (keys: readonly number[]) => {
        if (batchFn.mock.calls.length === 1) {
          started.resolve();
          return oldBatch.promise;
        }
        return keys.map(() => "refetched");
      });
      const loader = createBatchLoader({ name: "replacement", batchFn });
      const oldResult = loader.load(1).catch((error: unknown) => error);
      await started.promise;
      if (clear) loader.clear(1);
      const replacement = primeError ? new Error("primed failure") : "newly saved";
      loader.prime(1, replacement);
      expect(await loader.load(1).catch((error: unknown) => error)).toBe(replacement);

      if (failureKind === "batch") oldBatch.reject(failure);
      else oldBatch.resolve([failure]);
      expect(await oldResult).toBe(failure);
      expect(await loader.load(1).catch((error: unknown) => error)).toBe(replacement);
      expect(batchFn).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["batch", false],
    ["key", false],
    ["batch", true],
    ["key", true],
  ] as const)(
    "preserves a newer load after an older %s failure (resolved=%s)",
    async (failureKind, resolved) => {
      const oldBatch = deferred<readonly (string | Error)[]>();
      const newBatch = deferred<readonly (string | Error)[]>();
      const oldStarted = deferred<void>();
      const newStarted = deferred<void>();
      const failure = new Error("old batch failed");
      const batchFn = vi.fn(async () => {
        if (batchFn.mock.calls.length === 1) {
          oldStarted.resolve();
          return oldBatch.promise;
        }
        newStarted.resolve();
        return newBatch.promise;
      });
      const loader = createBatchLoader<number, string>({ name: "reload", batchFn });
      const oldResult = loader.load(1).catch((error: unknown) => error);
      await oldStarted.promise;
      loader.clearAll();
      const newResult = loader.load(1);
      await newStarted.promise;
      if (resolved) {
        newBatch.resolve(["new value"]);
        expect(await newResult).toBe("new value");
      }
      if (failureKind === "batch") oldBatch.reject(failure);
      else oldBatch.resolve([failure]);
      expect(await oldResult).toBe(failure);
      const cachedResult = loader.load(1);
      newBatch.resolve(["new value"]);
      expect(await Promise.all([newResult, cachedResult])).toEqual(["new value", "new value"]);
      expect(await loader.load(1)).toBe("new value");
      expect(batchFn).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["batch", "key"] as const)(
    "evicts the latest same-tick load on a %s failure so it can retry",
    async (failureKind) => {
      const failure = new Error("batch failed");
      const batchFn = vi.fn(async (keys: readonly number[]) => {
        if (batchFn.mock.calls.length === 1) {
          if (failureKind === "batch") throw failure;
          return keys.map(() => failure);
        }
        return keys.map(() => "retried");
      });
      const loader = createBatchLoader({ name: "retry", batchFn });
      const first = loader.load(1).catch((error: unknown) => error);
      loader.clear(1);
      const second = loader.load(1).catch((error: unknown) => error);
      expect(await Promise.all([first, second])).toEqual([failure, failure]);
      expect(await loader.load(1)).toBe("retried");
      expect(batchFn).toHaveBeenCalledTimes(2);
    },
  );
});
