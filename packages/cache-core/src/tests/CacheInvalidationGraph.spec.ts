import { describe, expect, it, vi } from "vitest";
import {
  assertCacheInvalidatesForEvent,
  assertCacheInvalidationGraphValid,
  CacheInvalidationFailedProblem,
  CacheInvalidationGraphProblem,
  createCacheAdapterCapabilityManifest,
  createCacheInvalidationManifest,
  createCacheStoreInvalidationAdapter,
  defineCacheInvalidationEvent,
  defineCacheInvalidationGraph,
  defineCacheInvalidationRule,
  defineCacheKey,
  defineCacheTag,
  invalidateCacheForEvent,
  invalidateCacheKey,
  invalidateCacheTag,
  InMemoryCacheStore,
  serializeCacheInvalidationManifest,
} from "../index";

describe("Cache Invalidation Graph", () => {
  function createUserInvalidationGraph() {
    return defineCacheInvalidationGraph({
      events: [
        defineCacheInvalidationEvent({ eventName: "user.updated" }),
        defineCacheInvalidationEvent({ eventName: "user.deleted" }),
      ],
      keys: [
        defineCacheKey({
          id: "user-by-id",
          pattern: "user:*",
          description: "User detail entries keyed by user id.",
        }),
        defineCacheKey({
          id: "user-list",
          key: "users:list",
          description: "Cached user list.",
        }),
      ],
      tags: [
        defineCacheTag({
          id: "tenant-users",
          tag: "tenant:users",
          description: "Tenant-wide user caches.",
        }),
      ],
      rules: [
        defineCacheInvalidationRule({
          eventName: "user.updated",
          invalidates: [invalidateCacheKey("user-by-id"), invalidateCacheKey("user-list")],
        }),
        defineCacheInvalidationRule({
          eventName: "user.deleted",
          invalidates: [invalidateCacheKey("user-by-id"), invalidateCacheTag("tenant-users")],
        }),
      ],
    });
  }

  it("emits a deterministic manifest for event to cache key and tag invalidation", () => {
    const manifest = createCacheInvalidationManifest(createUserInvalidationGraph());

    expect(manifest).toMatchObject({
      schemaVersion: "croco.cache-invalidation-graph.manifest.v1",
      status: "ready",
      diagnostics: [],
      events: [
        {
          eventName: "user.deleted",
          invalidates: [
            { id: "tenant-users", kind: "tag", tag: "tenant:users" },
            { id: "user-by-id", kind: "pattern", pattern: "user:*" },
          ],
        },
        {
          eventName: "user.updated",
          invalidates: [
            { id: "user-by-id", kind: "pattern", pattern: "user:*" },
            { id: "user-list", key: "users:list", kind: "key" },
          ],
        },
      ],
    });

    expect(serializeCacheInvalidationManifest(manifest)).toBe(
      serializeCacheInvalidationManifest(manifest),
    );
  });

  it("fails graph checks for unknown event references and orphan cache rules", () => {
    const manifest = createCacheInvalidationManifest(
      defineCacheInvalidationGraph({
        events: [defineCacheInvalidationEvent({ eventName: "user.updated" })],
        keys: [defineCacheKey({ id: "user-by-id", pattern: "user:*" })],
        tags: [],
        rules: [
          defineCacheInvalidationRule({
            eventName: "user.missing",
            invalidates: [invalidateCacheKey("user-by-id")],
          }),
          defineCacheInvalidationRule({
            eventName: "user.updated",
            invalidates: [invalidateCacheKey("missing-key"), invalidateCacheTag("missing-tag")],
          }),
        ],
      }),
    );

    expect(manifest.status).toBe("failed");
    expect(manifest.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "cache-invalidation/orphan-cache-key-rule",
      "cache-invalidation/orphan-cache-tag-rule",
      "cache-invalidation/unknown-event-reference",
    ]);
    expect(() => assertCacheInvalidationGraphValid(manifest)).toThrow(
      CacheInvalidationGraphProblem,
    );
  });

  it("keeps distinct invalidations when ids and keys contain separator characters", () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(
        defineCacheInvalidationGraph({
          events: [defineCacheInvalidationEvent({ eventName: "user.updated" })],
          keys: [
            defineCacheKey({ id: "tenant", key: "key:a" }),
            defineCacheKey({ id: "tenant:key", key: "a" }),
          ],
          rules: [
            defineCacheInvalidationRule({
              eventName: "user.updated",
              invalidates: [invalidateCacheKey("tenant"), invalidateCacheKey("tenant:key")],
            }),
          ],
        }),
      ),
    );

    expect(manifest.events[0]?.invalidates).toHaveLength(2);
    expect(manifest.events[0]?.invalidates).toContainEqual({
      id: "tenant",
      key: "key:a",
      kind: "key",
    });
    expect(manifest.events[0]?.invalidates).toContainEqual({
      id: "tenant:key",
      key: "a",
      kind: "key",
    });
  });

  it("invalidates event-declared cache entries and prevents stale reads", async () => {
    const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );
    const adapter = createCacheStoreInvalidationAdapter(cache);

    await cache.set("user:123", "stale-detail");
    await cache.set("user:456", "stale-other-detail");
    await cache.set("users:list", "stale-list");

    const result = await invalidateCacheForEvent({
      adapter,
      event: { eventName: "user.updated" },
      manifest,
    });

    expect(result.operations).toEqual([
      { affectedCount: 2, id: "user-by-id", kind: "pattern", pattern: "user:*" },
      { id: "user-list", key: "users:list", kind: "key" },
    ]);
    expect(await cache.get("user:123")).toBeUndefined();
    expect(await cache.get("user:456")).toBeUndefined();
    expect(await cache.get("users:list")).toBeUndefined();

    const loader = vi.fn(async () => "fresh-list");

    await expect(cache.getOrSet("users:list", loader)).resolves.toBe("fresh-list");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("attempts later invalidations when a middle operation fails", async () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(
        defineCacheInvalidationGraph({
          events: [defineCacheInvalidationEvent({ eventName: "user.updated" })],
          keys: [
            defineCacheKey({ id: "a-key", key: "user:1" }),
            defineCacheKey({ id: "b-pattern", pattern: "user:*" }),
          ],
          tags: [defineCacheTag({ id: "c-tag", tag: "tenant:users" })],
          rules: [
            defineCacheInvalidationRule({
              eventName: "user.updated",
              invalidates: [
                invalidateCacheKey("a-key"),
                invalidateCacheKey("b-pattern"),
                invalidateCacheTag("c-tag"),
              ],
            }),
          ],
        }),
      ),
    );
    const adapterFailure = new Error("pattern adapter unavailable");
    const attempted: string[] = [];
    const adapter = {
      capabilities: {
        exactKey: true,
        pattern: true,
        tag: true,
      },
      invalidateKey: vi.fn(async (key: string) => {
        attempted.push(`key:${key}`);
      }),
      invalidatePattern: vi.fn(async (pattern: string) => {
        attempted.push(`pattern:${pattern}`);
        throw adapterFailure;
      }),
      invalidateTag: vi.fn(async (tag: string) => {
        attempted.push(`tag:${tag}`);
      }),
      name: "test-cache",
    };
    const telemetry = {
      recordError: vi.fn(),
      recordEvent: vi.fn(),
    };

    const invalidation = invalidateCacheForEvent({
      adapter,
      event: "user.updated",
      manifest,
      telemetry,
    });

    await expect(invalidation).rejects.toMatchObject({
      code: "cache-core/invalidation-failed",
      failures: [
        {
          adapterName: "test-cache",
          causeMessage: "pattern adapter unavailable",
          eventName: "user.updated",
          operation: { id: "b-pattern", kind: "pattern", pattern: "user:*" },
        },
      ],
    });
    await expect(invalidation).rejects.toHaveProperty("cause", adapterFailure);
    expect(attempted).toEqual(["key:user:1", "pattern:user:*", "tag:tenant:users"]);
    expect(telemetry.recordError).toHaveBeenCalledTimes(1);
    expect(telemetry.recordEvent).toHaveBeenCalledTimes(2);
    expect(telemetry.recordError.mock.calls[0]?.[0]).toMatchObject({
      failures: [
        {
          adapterName: "test-cache",
          causeMessage: "pattern adapter unavailable",
          eventName: "user.updated",
          operation: { id: "b-pattern", kind: "pattern", pattern: "user:*" },
        },
      ],
    });
    expect(telemetry.recordError.mock.calls[0]?.[1]).toEqual({
      adapterName: "test-cache",
      eventName: "user.updated",
      operation: { id: "b-pattern", kind: "pattern", pattern: "user:*" },
    });
  });

  it("reports every failed invalidation in operation order", async () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );
    const patternFailure = new Error("pattern adapter unavailable");
    const keyFailure = new Error("key adapter unavailable");
    const telemetry = {
      recordError: vi.fn(),
    };
    const expectedFailures = [
      {
        adapterName: "failing-cache",
        causeMessage: "pattern adapter unavailable",
        eventName: "user.updated",
        operation: { id: "user-by-id", kind: "pattern", pattern: "user:*" },
      },
      {
        adapterName: "failing-cache",
        causeMessage: "key adapter unavailable",
        eventName: "user.updated",
        operation: { id: "user-list", key: "users:list", kind: "key" },
      },
    ];

    const invalidation = invalidateCacheForEvent({
      adapter: {
        capabilities: {
          exactKey: true,
          pattern: true,
          tag: false,
        },
        invalidateKey: vi.fn(async () => {
          throw keyFailure;
        }),
        invalidatePattern: vi.fn(async () => {
          throw patternFailure;
        }),
        name: "failing-cache",
      },
      event: "user.updated",
      manifest,
      telemetry,
    });

    await expect(invalidation).rejects.toMatchObject({
      cause: patternFailure,
      failures: expectedFailures,
    });
    expect(telemetry.recordError).toHaveBeenCalledTimes(2);
    expect(telemetry.recordError.mock.calls[0]?.[0]).toHaveProperty("cause", patternFailure);
    expect(telemetry.recordError.mock.calls[1]?.[0]).toHaveProperty("cause", keyFailure);
  });

  it("preserves the original adapter cause and reported Problem when error telemetry throws", async () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );
    const adapterFailure = new Error("adapter unavailable");
    const adapter = {
      capabilities: {
        exactKey: true,
        pattern: true,
        tag: false,
      },
      invalidateKey: vi.fn(async () => ({ affectedCount: 1 })),
      invalidatePattern: vi.fn(async () => {
        throw adapterFailure;
      }),
      name: "limited-cache",
    };
    const telemetry = {
      recordError: vi.fn((_problem: CacheInvalidationFailedProblem) => {
        throw new Error("telemetry unavailable");
      }),
      recordEvent: vi.fn(),
    };

    const invalidation = invalidateCacheForEvent({
      adapter,
      event: "user.updated",
      manifest,
      telemetry,
    });
    await expect(invalidation).rejects.toBeInstanceOf(CacheInvalidationFailedProblem);
    await expect(invalidation).rejects.toHaveProperty("cause", adapterFailure);
    await expect(invalidation).rejects.toBe(telemetry.recordError.mock.calls[0]?.[0]);

    expect(telemetry.recordError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "cache-core/invalidation-failed" }),
      expect.objectContaining({
        adapterName: "limited-cache",
        eventName: "user.updated",
        operation: { id: "user-by-id", kind: "pattern", pattern: "user:*" },
      }),
    );
    expect(telemetry.recordError).toHaveBeenCalledTimes(1);
    expect(adapter.invalidateKey).toHaveBeenCalledWith("users:list");
    expect(telemetry.recordEvent).toHaveBeenCalledTimes(1);
  });

  it("serializes invalidation failures without a cause code for non-Problem causes", () => {
    const problem = new CacheInvalidationFailedProblem(
      "user.updated",
      "memory-cache",
      { id: "user-by-id", kind: "key", key: "user:1" },
      new Error("cache unavailable"),
    );

    expect(problem.extensions).toEqual({
      adapterName: "memory-cache",
      causeMessage: "cache unavailable",
      eventName: "user.updated",
      operation: { id: "user-by-id", kind: "key", key: "user:1" },
    });
    expect(problem.failures).toEqual([
      {
        adapterName: "memory-cache",
        causeMessage: "cache unavailable",
        eventName: "user.updated",
        operation: { id: "user-by-id", kind: "key", key: "user:1" },
      },
    ]);
    expect(problem.toJSON()).not.toHaveProperty("causeCode");
    expect(() => JSON.stringify(problem)).not.toThrow();
  });

  it("preserves failure sets larger than the Problem extension budget", async () => {
    const operationCount = 1_250;
    const keys = Array.from({ length: operationCount }, (_, index) =>
      defineCacheKey({ id: `key-${index}`, key: `cache:${index}` }),
    );
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(
        defineCacheInvalidationGraph({
          events: [defineCacheInvalidationEvent({ eventName: "cache.bulk-updated" })],
          keys,
          rules: [
            defineCacheInvalidationRule({
              eventName: "cache.bulk-updated",
              invalidates: keys.map(({ id }) => invalidateCacheKey(id)),
            }),
          ],
        }),
      ),
    );
    const invalidateKey = vi.fn(async () => {
      throw new Error("cache unavailable");
    });

    const problem = await invalidateCacheForEvent({
      adapter: {
        capabilities: { exactKey: true, pattern: false, tag: false },
        invalidateKey,
        name: "bulk-cache",
      },
      event: "cache.bulk-updated",
      manifest,
    }).catch((cause: unknown) => cause);

    expect(problem).toBeInstanceOf(CacheInvalidationFailedProblem);
    if (!(problem instanceof CacheInvalidationFailedProblem)) {
      throw new Error("Expected cache invalidation failure");
    }
    expect(problem.code).toBe("cache-core/invalidation-failed");
    expect(problem.failures).toHaveLength(operationCount);
    expect(new Set(problem.failures.map(({ operation }) => operation.id)).size).toBe(
      operationCount,
    );
    expect(invalidateKey).toHaveBeenCalledTimes(operationCount);
    expect(() => JSON.stringify(problem)).not.toThrow();
  });

  it("does not let telemetry event failures change successful invalidation", async () => {
    const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );
    const telemetry = {
      recordEvent: vi.fn(() => {
        throw new Error("telemetry unavailable");
      }),
    };

    await cache.set("user:123", "stale-detail");
    await cache.set("users:list", "stale-list");

    await expect(
      invalidateCacheForEvent({
        adapter: createCacheStoreInvalidationAdapter(cache),
        event: "user.updated",
        manifest,
        telemetry,
      }),
    ).resolves.toEqual({
      eventName: "user.updated",
      operations: [
        { affectedCount: 1, id: "user-by-id", kind: "pattern", pattern: "user:*" },
        { id: "user-list", key: "users:list", kind: "key" },
      ],
    });
    expect(await cache.get("user:123")).toBeUndefined();
    expect(await cache.get("users:list")).toBeUndefined();
    expect(telemetry.recordEvent).toHaveBeenCalledTimes(2);
  });

  it("describes cache adapter invalidation capabilities", () => {
    const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
    const adapter = createCacheStoreInvalidationAdapter(cache, { name: "memory-reference" });

    expect(createCacheAdapterCapabilityManifest(adapter)).toEqual({
      adapterName: "memory-reference",
      capabilities: {
        exactKey: true,
        pattern: true,
        tag: false,
      },
      schemaVersion: "croco.cache-adapter-capabilities.v1",
    });
  });

  it("provides a test helper for event to cache invalidation assertions", () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );

    expect(() =>
      assertCacheInvalidatesForEvent({
        eventName: "user.deleted",
        expectedInvalidations: [
          { id: "user-by-id", kind: "pattern", pattern: "user:*" },
          { id: "tenant-users", kind: "tag", tag: "tenant:users" },
        ],
        manifest,
      }),
    ).not.toThrow();
  });
});
