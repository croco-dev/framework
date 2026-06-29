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

  it("records telemetry evidence and throws a Problem when invalidation fails", async () => {
    const manifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(createUserInvalidationGraph()),
    );
    const adapter = {
      capabilities: {
        exactKey: true,
        pattern: false,
        tag: false,
      },
      invalidateKey: vi.fn(async () => ({ affectedCount: 1 })),
      name: "limited-cache",
    };
    const telemetry = {
      recordError: vi.fn(() => {
        throw new Error("telemetry unavailable");
      }),
      recordEvent: vi.fn(),
    };

    await expect(
      invalidateCacheForEvent({
        adapter,
        event: "user.updated",
        manifest,
        telemetry,
      }),
    ).rejects.toBeInstanceOf(CacheInvalidationFailedProblem);

    expect(telemetry.recordError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "cache-core/invalidation-failed" }),
      expect.objectContaining({
        adapterName: "limited-cache",
        eventName: "user.updated",
        operation: { id: "user-by-id", kind: "pattern", pattern: "user:*" },
      }),
    );
    expect(telemetry.recordEvent).not.toHaveBeenCalled();
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
