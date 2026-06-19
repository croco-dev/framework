import { InMemoryCacheStore } from "@croco/cache-core";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { RedisCacheStoreAdapter } from "../libs/isr/adapters/redisAdapter";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import {
  createDurableIsrCacheProfile,
  createLocalIsrCacheProfile,
  evaluateIsrRuntimeSupport,
} from "../libs/isr/runtimeSupport";
import type { IsrCacheStore } from "../libs/isr/types";
import { createCloudflareComposedHandler } from "../libs/providers/cloudflare";
import { createLambdaComposedHandler } from "../libs/providers/lambda";
import { createNodeComposedHandler } from "../libs/providers/node";
import type { CrocoFetchHandler } from "../libs/render/types";

describe("ISR runtime support", () => {
  it("smokes durable Node ISR through RedisCacheStoreAdapter", async () => {
    const { adapter: cache, redis } = createMemoryRedisAdapter("node-isr:");
    const profile = createDurableIsrCacheProfile(cache, { label: "RedisCacheStoreAdapter" });
    const report = evaluateIsrRuntimeSupport({
      runtime: "node",
      cache: profile,
      requireDurable: true,
    });
    const state = { renderCount: 0 };
    const isr = createIsrMiddleware({
      cache: profile.store,
      ttlMs: 60_000,
      render: async () => new Response(`node-render-${++state.renderCount}`),
    });
    const handler = createNodeComposedHandler({ apiHandlers: [], pageHandler: isr });

    const first = await handler.fetch(new Request("https://example.test/cached"));
    const second = await handler.fetch(new Request("https://example.test/cached"));

    expect(report).toEqual({
      runtime: "node",
      cacheLabel: "RedisCacheStoreAdapter",
      supported: true,
      durable: true,
      diagnostics: [],
    });
    await expect(first.text()).resolves.toBe("node-render-1");
    await expect(second.text()).resolves.toBe("node-render-1");
    expect(state.renderCount).toBe(1);
    expect(redis.setex).toHaveBeenCalledOnce();
  });

  it("smokes durable Lambda ISR through RedisCacheStoreAdapter", async () => {
    const { adapter: cache, redis } = createMemoryRedisAdapter("lambda-isr:");
    const profile = createDurableIsrCacheProfile(cache, { label: "RedisCacheStoreAdapter" });
    const report = evaluateIsrRuntimeSupport({
      runtime: "lambda",
      cache: profile,
      requireDurable: true,
    });
    const state = { renderCount: 0 };
    const isr: CrocoFetchHandler = createIsrMiddleware({
      cache: profile.store,
      ttlMs: 60_000,
      render: async (request) =>
        new Response(`lambda-render-${++state.renderCount}:${new URL(request.url).pathname}`),
    });
    const handler = createLambdaComposedHandler({ apiHandlers: [], pageHandler: isr });

    const first = await handler(createHttpApiEvent({ rawPath: "/cached" }), {});
    const second = await handler(createHttpApiEvent({ rawPath: "/cached" }), {});

    expect(report.supported).toBe(true);
    expect(report.durable).toBe(true);
    expect(report.diagnostics).toEqual([]);
    await expect(first.text()).resolves.toBe("lambda-render-1:/cached");
    await expect(second.text()).resolves.toBe("lambda-render-1:/cached");
    expect(state.renderCount).toBe(1);
    expect(redis.setex).toHaveBeenCalledOnce();
  });

  it("reports in-memory cache as local-only for production durable ISR claims", () => {
    const profile = createLocalIsrCacheProfile(
      new InMemoryCacheStore<Response>({ maxEntries: 10 }),
      "InMemoryCacheStore",
    );
    const report = evaluateIsrRuntimeSupport({
      runtime: "node",
      cache: profile,
      requireDurable: true,
    });

    expect(report.supported).toBe(false);
    expect(report.durable).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY",
        severity: "error",
      }),
    ]);
  });

  it("keeps known in-memory stores local even when durable profile helper is misused", () => {
    const profile = createDurableIsrCacheProfile(
      new InMemoryCacheStore<Response>({ maxEntries: 10 }),
      { label: "InMemoryCacheStore" },
    );
    const report = evaluateIsrRuntimeSupport({
      runtime: "lambda",
      cache: profile,
      requireDurable: true,
    });

    expect(profile.durability).toBe("local");
    expect(report.supported).toBe(false);
    expect(report.durable).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY",
        severity: "error",
      }),
    ]);
  });

  it("keeps in-memory Workers ISR scoped to one cache instance", async () => {
    const state = { renderCount: 0 };
    const firstWorker = createCloudflareComposedHandler({
      apiHandlers: [],
      pageHandler: createIsrMiddleware({
        cache: createLocalIsrCacheProfile(new InMemoryCacheStore<Response>()).store,
        ttlMs: 60_000,
        render: async () => new Response(`worker-render-${++state.renderCount}`),
      }),
    });
    const secondWorker = createCloudflareComposedHandler({
      apiHandlers: [],
      pageHandler: createIsrMiddleware({
        cache: createLocalIsrCacheProfile(new InMemoryCacheStore<Response>()).store,
        ttlMs: 60_000,
        render: async () => new Response(`worker-render-${++state.renderCount}`),
      }),
    });

    const first = await firstWorker(
      new Request("https://worker.test/cached"),
      {},
      createExecutionContext(),
    );
    const second = await firstWorker(
      new Request("https://worker.test/cached"),
      {},
      createExecutionContext(),
    );
    const isolated = await secondWorker(
      new Request("https://worker.test/cached"),
      {},
      createExecutionContext(),
    );

    await expect(first.text()).resolves.toBe("worker-render-1");
    await expect(second.text()).resolves.toBe("worker-render-1");
    await expect(isolated.text()).resolves.toBe("worker-render-2");
  });

  it("rejects durable Workers ISR claims unless the store profile is Worker-safe", async () => {
    const localProfile = createLocalIsrCacheProfile(
      new InMemoryCacheStore<Response>(),
      "InMemoryCacheStore",
    );
    const unsafeProfile = createDurableIsrCacheProfile(new WorkerBindingCacheStore(), {
      label: "RedisCacheStoreAdapter",
    });
    const workerSafeProfile = createDurableIsrCacheProfile(new WorkerBindingCacheStore(), {
      label: "WorkerBindingCacheStore",
      workerSafe: true,
    });

    const localReport = evaluateIsrRuntimeSupport({
      runtime: "cloudflare-workers",
      cache: localProfile,
      requireDurable: true,
    });
    const unsafeReport = evaluateIsrRuntimeSupport({
      runtime: "cloudflare-workers",
      cache: unsafeProfile,
      requireDurable: true,
    });
    const workerSafeReport = evaluateIsrRuntimeSupport({
      runtime: "cloudflare-workers",
      cache: workerSafeProfile,
      requireDurable: true,
    });

    expect(localReport.supported).toBe(false);
    expect(localReport.durable).toBe(false);
    expect(localReport.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY",
        severity: "error",
      }),
    ]);
    expect(unsafeReport.supported).toBe(false);
    expect(unsafeReport.durable).toBe(false);
    expect(unsafeReport.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE",
        severity: "error",
      }),
    ]);
    expect(workerSafeReport.supported).toBe(true);
    expect(workerSafeReport.durable).toBe(true);
    expect(workerSafeReport.diagnostics).toEqual([]);
  });
});

function createMemoryRedisAdapter(prefix: string): {
  readonly adapter: RedisCacheStoreAdapter;
  readonly redis: Pick<Redis, "get" | "set" | "setex">;
} {
  const entries = new Map<string, string>();
  const redis = {
    get: vi.fn(async (key: string) => entries.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
      return "OK";
    }),
    setex: vi.fn(async (key: string, _ttlSeconds: number, value: string) => {
      entries.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => (entries.delete(key) ? 1 : 0)),
    pipeline: vi.fn(),
    scanStream: vi.fn(),
  } as unknown as Redis;

  return {
    adapter: new RedisCacheStoreAdapter(redis, prefix),
    redis,
  };
}

class WorkerBindingCacheStore implements IsrCacheStore {
  private readonly entries = new Map<string, Response>();

  async getOrSet(
    key: string,
    factory: () => Promise<Response>,
    _options?: { readonly ttlMs?: number },
  ): Promise<Response> {
    const cached = this.entries.get(key);
    if (cached) {
      return cached.clone();
    }

    const response = await factory();
    this.entries.set(key, response.clone());
    return response;
  }
}

function createHttpApiEvent(options: { readonly rawPath: string }): Record<string, unknown> {
  return {
    version: "2.0",
    rawPath: options.rawPath,
    rawQueryString: "",
    headers: { host: "lambda.local" },
    requestContext: {
      http: {
        method: "GET",
        path: options.rawPath,
      },
    },
  };
}

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}
