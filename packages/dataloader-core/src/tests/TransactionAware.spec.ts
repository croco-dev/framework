import { Context } from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import { createBatchLoader } from "../libs/createBatchLoader";

describe("createBatchLoader (Transaction Aware)", () => {
  it("should isolate cache based on resolveScope return value", async () => {
    let currentTxId: string | null = null;

    const batchFn = vi.fn(async (keys: ReadonlyArray<number>) => {
      return keys.map((key) => `Value ${key}`);
    });

    const loaderFactory = createBatchLoader({
      name: "UserLoader",
      batchFn,
      resolveScope: () => currentTxId,
    });

    await Context.run({ requestId: "req-1" }, async () => {
      // 1. No transaction (txId = null)
      currentTxId = null;
      const loader1 = loaderFactory;
      await loader1.load(1);
      expect(batchFn).toHaveBeenCalledTimes(1);

      // Same context, same scope -> should hit cache (no new batch call)
      await loader1.load(1);
      expect(batchFn).toHaveBeenCalledTimes(1);

      // 2. Start Transaction A
      currentTxId = "tx-a";
      // resolveScope changed, so we should get a NEW loader instance (internally)
      // and thus a cold cache
      await loaderFactory.load(1);
      expect(batchFn).toHaveBeenCalledTimes(2); // New batch call

      // Load again in same tx -> cache hit
      await loaderFactory.load(1);
      expect(batchFn).toHaveBeenCalledTimes(2);

      // 3. Start Transaction B (nested or separate)
      currentTxId = "tx-b";
      await loaderFactory.load(1);
      expect(batchFn).toHaveBeenCalledTimes(3); // New batch call due to new scope

      // 4. Rollback/End Transaction (Back to null or previous)
      currentTxId = null;
      // Should return to the original loader instance (if it was cached)
      // Since Context.getCache() persists map entries for the request duration:
      // 'dataloader:UserLoader:v1' <- exists
      // 'dataloader:UserLoader:v1:scope:tx-a' <- exists
      // 'dataloader:UserLoader:v1:scope:tx-b' <- exists

      // When we go back to null scope, we access 'dataloader:UserLoader:v1'
      await loaderFactory.load(1);
      expect(batchFn).toHaveBeenCalledTimes(3); // Should hit the first cache
    });
  });

  it("should share cache when resolveScope returns same value", async () => {
    const batchFn = vi.fn(async (keys: ReadonlyArray<number>) => keys.map((k) => k * 2));

    const loaderFactory = createBatchLoader({
      name: "DoubleLoader",
      batchFn,
      resolveScope: () => "static-scope",
    });

    await Context.run({ requestId: "req-2" }, async () => {
      await loaderFactory.load(10);
      await loaderFactory.load(10);
      expect(batchFn).toHaveBeenCalledTimes(1);
    });
  });
});
