import { Context } from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import { DuplicateBatchLoaderNameProblem } from "../index";
import { createBatchLoader } from "../libs/createBatchLoader";

describe("createBatchLoader inside a request context", () => {
  const createEntityLoader = (kind: string, name: string) => {
    const batchFn = vi.fn(async (ids: readonly number[]) => ids.map((id) => ({ kind, id })));
    return { batchFn, loader: createBatchLoader({ name, batchFn }) };
  };

  it("rejects a different loader that reuses a name without touching the first loader", async () => {
    const users = createEntityLoader("user", "byId");
    const posts = createEntityLoader("post", "byId");

    await Context.run({ requestId: "duplicate-name" }, async () => {
      expect(await users.loader.load(1)).toEqual({ kind: "user", id: 1 });

      const duplicate = { name: "byId", scope: null, dynamicScope: null };
      expect(() => posts.loader.load(2)).toThrow(DuplicateBatchLoaderNameProblem);
      expect(() => posts.loader.load(1)).toThrow(
        expect.objectContaining({
          code: "dataloader-core/duplicate-loader-name",
          extensions: duplicate,
        }),
      );
      expect(() => posts.loader.loadMany([1])).toThrow(DuplicateBatchLoaderNameProblem);
      expect(() => posts.loader.prime(1, { kind: "post", id: 1 })).toThrow(
        DuplicateBatchLoaderNameProblem,
      );
      expect(() => posts.loader.clear(1)).toThrow(DuplicateBatchLoaderNameProblem);
      expect(() => posts.loader.clearAll()).toThrow(DuplicateBatchLoaderNameProblem);

      expect(await users.loader.load(1)).toEqual({ kind: "user", id: 1 });
    });

    expect(users.batchFn).toHaveBeenCalledExactlyOnceWith([1]);
    expect(posts.batchFn).not.toHaveBeenCalled();
  });

  it("reports the static and dynamic scope that collided", async () => {
    const options = { name: "byId", scope: "tenant-a", resolveScope: () => "tx-1" };
    const first = createBatchLoader({ ...options, batchFn: async (ids: readonly number[]) => ids });
    const second = createBatchLoader({
      ...options,
      batchFn: async (ids: readonly number[]) => ids,
    });

    await Context.run({ requestId: "duplicate-scope" }, async () => {
      expect(await first.load(1)).toBe(1);
      expect(() => second.load(1)).toThrow(
        expect.objectContaining({
          code: "dataloader-core/duplicate-loader-name",
          extensions: { name: "byId", scope: "tenant-a", dynamicScope: "tx-1" },
        }),
      );
    });
  });

  it("shares batches and cached results across repeated calls of one factory", async () => {
    const users = createEntityLoader("user", "byId");

    await Context.run({ requestId: "same-factory" }, async () => {
      expect(await Promise.all([users.loader.load(1), users.loader.loadMany([2, 1])])).toEqual([
        { kind: "user", id: 1 },
        [
          { kind: "user", id: 2 },
          { kind: "user", id: 1 },
        ],
      ]);
      expect(await users.loader.load(2)).toEqual({ kind: "user", id: 2 });
    });

    expect(users.batchFn).toHaveBeenCalledExactlyOnceWith([1, 2]);
  });

  it("keeps same-name loaders with different static or dynamic scopes independent", async () => {
    const byScope = (scope: string) =>
      createBatchLoader({
        name: "byId",
        scope,
        batchFn: async (ids: readonly number[]) => ids.map((id) => `${scope}:${id}`),
      });
    const byDynamicScope = (scope: string) =>
      createBatchLoader({
        name: "byId",
        resolveScope: () => scope,
        batchFn: async (ids: readonly number[]) => ids.map((id) => `${scope}:${id}`),
      });

    await Context.run({ requestId: "distinct-scopes" }, async () => {
      expect(await byScope("users").load(1)).toBe("users:1");
      expect(await byScope("posts").load(1)).toBe("posts:1");
      expect(await byDynamicScope("tx-a").load(1)).toBe("tx-a:1");
      expect(await byDynamicScope("tx-b").load(1)).toBe("tx-b:1");
    });
  });

  it("allows another request to use the name with a different loader", async () => {
    const users = createEntityLoader("user", "byId");
    const posts = createEntityLoader("post", "byId");

    await Context.run({ requestId: "users" }, async () => {
      expect(await users.loader.load(1)).toEqual({ kind: "user", id: 1 });
    });
    await Context.run({ requestId: "posts" }, async () => {
      expect(await posts.loader.load(1)).toEqual({ kind: "post", id: 1 });
    });
  });
});

describe("createBatchLoader outside a request context", () => {
  it("batches load and loadMany calls and retains cached results across dispatches", async () => {
    expect(Context.getCache()).toBeUndefined();
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "standalone", batchFn });

    expect(await Promise.all([loader.load(1), loader.loadMany([2, 1])])).toEqual([2, [4, 2]]);
    expect(batchFn).toHaveBeenCalledExactlyOnceWith([1, 2]);
    expect(await loader.loadMany([1, 2])).toEqual([2, 4]);
    expect(batchFn).toHaveBeenCalledTimes(1);
  });

  it("retains primed values and clears individual keys and the entire cache", async () => {
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "standalone", batchFn });
    loader.prime(1, 10);
    loader.prime(2, 20);
    expect(await loader.loadMany([1, 2])).toEqual([10, 20]);
    expect(batchFn).not.toHaveBeenCalled();

    loader.clear(1);
    expect(await loader.loadMany([1, 2])).toEqual([2, 20]);
    expect(batchFn).toHaveBeenLastCalledWith([1]);
    loader.clearAll();
    expect(await loader.loadMany([1, 2])).toEqual([2, 4]);
    expect(batchFn).toHaveBeenLastCalledWith([1, 2]);
    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it("isolates standalone instances even when factories have the same name", async () => {
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const first = createBatchLoader({ name: "shared-name", batchFn });
    const second = createBatchLoader({ name: "shared-name", batchFn });
    first.prime(1, 10);
    expect(await first.load(1)).toBe(10);
    expect(await second.load(1)).toBe(2);
    second.clearAll();
    expect(await first.load(1)).toBe(10);
    expect(batchFn).toHaveBeenCalledTimes(1);
  });

  it("isolates overlapping request caches from each other and the standalone cache", async () => {
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "standalone", batchFn });
    loader.prime(1, 10);
    await Promise.all(
      [20, 30].map((value) =>
        Context.run({ requestId: String(value) }, async () => {
          expect(await loader.load(1)).toBe(2);
          loader.prime(1, value);
          await Promise.resolve();
          expect(await loader.load(1)).toBe(value);
          loader.clearAll();
        }),
      ),
    );
    expect(await loader.load(1)).toBe(10);
    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it("isolates standalone caches when the dynamic scope changes", async () => {
    let scope: string | null = null;
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => `${scope}:${key}`));
    const loader = createBatchLoader({ name: "scoped", batchFn, resolveScope: () => scope });
    expect(await loader.load(1)).toBe("null:1");
    scope = "tx-a";
    expect(await loader.load(1)).toBe("tx-a:1");
    loader.prime(2, "primed-a");
    scope = "tx-b";
    expect(await loader.loadMany([1, 2])).toEqual(["tx-b:1", "tx-b:2"]);
    loader.clearAll();
    scope = "tx-a";
    expect(await loader.loadMany([1, 2])).toEqual(["tx-a:1", "primed-a"]);
    scope = null;
    expect(await loader.load(1)).toBe("null:1");
    expect(batchFn).toHaveBeenCalledTimes(3);
  });

  it("keeps overlapping standalone scope batches separate", async () => {
    let scope = "tx-a";
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "scoped", batchFn, resolveScope: () => scope });
    const first = loader.load(1);
    scope = "tx-b";
    const second = loader.load(2);
    scope = "tx-a";
    const third = loader.load(3);
    expect(await Promise.all([first, second, third])).toEqual([2, 4, 6]);
    expect(batchFn).toHaveBeenCalledTimes(2);
    expect(batchFn).toHaveBeenCalledWith([1, 3]);
    expect(batchFn).toHaveBeenCalledWith([2]);
  });

  it("still batches with caching disabled without retaining results", async () => {
    const batchFn = vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "uncached", batchFn, cache: false });
    expect(await Promise.all([loader.load(1), loader.load(2)])).toEqual([2, 4]);
    expect(batchFn).toHaveBeenCalledExactlyOnceWith([1, 2]);
    expect(await loader.load(1)).toBe(2);
    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it("retries rejected batches using the retained instance", async () => {
    const failure = new Error("batch failed");
    const batchFn = vi
      .fn<(keys: readonly number[]) => Promise<number[]>>()
      .mockRejectedValueOnce(failure)
      .mockImplementation(async (keys) => keys.map((key) => key * 2));
    const loader = createBatchLoader({ name: "retry", batchFn });
    expect(await loader.loadMany([1, 2])).toEqual([failure, failure]);
    expect(await loader.loadMany([1, 2])).toEqual([2, 4]);
    expect(await loader.load(1)).toBe(2);
    expect(batchFn).toHaveBeenCalledTimes(2);
  });
});
