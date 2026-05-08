import type { IsrCacheAdapter } from './types';

/**
 * Create an ISR handler that wraps a render function with CacheStore-backed caching.
 * v1: exact-key TTL-only, no pattern invalidation or durable storage.
 */
export function createIsrHandler(options: {
  cache: IsrCacheAdapter;
  render: (path: string) => Promise<{ html: string; cacheTags?: string[] }>;
}): (path: string) => Promise<{ html: string; source: 'cache' | 'render' }> {
  const { cache, render } = options;

  return async (path: string) => {
    const cacheKey = `isr:${path}`;

    const result = await cache.getOrSet(
      cacheKey,
      async () => {
        const rendered = await render(path);
        return rendered;
      }
      // TTL is set per-route by the caller via render options
    );

    return {
      html: result.html,
      source: 'render' as const,
    };
  };
}
