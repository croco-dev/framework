import { Context } from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import { BatchLoaderFactory, createBatchLoader, DuplicateBatchLoaderNameProblem } from "../index";

describe("BatchLoaderFactory", () => {
  const double = () => vi.fn(async (keys: readonly number[]) => keys.map((key) => key * 2));

  it("retrieves one request loader for repeated creates with the same name", async () => {
    const firstBatchFn = double();
    const secondBatchFn = double();

    await Context.run({ requestId: "factory-reuse" }, async () => {
      const first = new BatchLoaderFactory().create({ name: "byId", batchFn: firstBatchFn });
      const second = new BatchLoaderFactory().create({ name: "byId", batchFn: secondBatchFn });
      expect(await Promise.all([first.load(1), second.load(2)])).toEqual([2, 4]);
    });

    expect(firstBatchFn).toHaveBeenCalledExactlyOnceWith([1, 2]);
    expect(secondBatchFn).not.toHaveBeenCalled();
  });

  it("documents direct-caller name sharing with sequentially used same-name loaders", async () => {
    await Context.run({ requestId: "factory-shared-name" }, async () => {
      const factory = new BatchLoaderFactory();
      const users = factory.create({
        name: "byId",
        batchFn: async (ids: readonly number[]) => ids.map((id) => `user:${id}`),
      });
      expect(await users.load(1)).toBe("user:1");

      const posts = factory.create({
        name: "byId",
        batchFn: async (ids: readonly number[]) => ids.map((id) => `post:${id}`),
      });
      expect(await posts.load(2)).toBe("user:2");
    });
  });

  it("serves the first-used wrapper's batchFn when the second wrapper loads first", async () => {
    await Context.run({ requestId: "factory-first-use-wins" }, async () => {
      const factory = new BatchLoaderFactory();
      const first = factory.create({
        name: "byId",
        batchFn: async (ids: readonly number[]) => ids.map((id) => `first:${id}`),
      });
      const second = factory.create({
        name: "byId",
        batchFn: async (ids: readonly number[]) => ids.map((id) => `second:${id}`),
      });
      expect(await second.load(1)).toBe("second:1");
      expect(await first.load(2)).toBe("second:2");
    });
  });

  it("rejects a createBatchLoader factory that reuses a factory-created loader name", async () => {
    const batchFn = double();

    await Context.run({ requestId: "factory-collision" }, async () => {
      expect(await new BatchLoaderFactory().create({ name: "byId", batchFn }).load(1)).toBe(2);
      expect(() => createBatchLoader({ name: "byId", batchFn }).load(1)).toThrow(
        DuplicateBatchLoaderNameProblem,
      );
    });
  });

  it("rejects a factory-created loader that reuses a createBatchLoader name", async () => {
    const batchFn = double();

    await Context.run({ requestId: "loader-collision" }, async () => {
      expect(await createBatchLoader({ name: "byId", batchFn }).load(1)).toBe(2);
      expect(() => new BatchLoaderFactory().create({ name: "byId", batchFn }).load(1)).toThrow(
        DuplicateBatchLoaderNameProblem,
      );
    });
  });
});
