import type { CacheStore } from '@croco/cache-core';

/**
 * ISR cache adapter contract.
 * Wraps `@croco/cache-core` CacheStore for TTL-only ISR use.
 * v1: exact-key + TTL-only getOrSet semantics.
 */
export type IsrCacheAdapter = {
  getOrSet: <V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) => Promise<V>;
  invalidate: (key: string) => Promise<void>;
};

export type IsrCacheStore = Pick<CacheStore<string, Response>, 'getOrSet'>;

/**
 * InMemoryCacheStore-based ISR is non-durable and intended for local, development,
 * or single-process deployments only.
 */
export type IsrMiddlewareOptions = {
  readonly cache: IsrCacheStore;
  readonly render: (request: Request) => Promise<Response>;
  readonly ttlMs: number;
};

export type IsrMiddleware = (request: Request) => Promise<Response>;
