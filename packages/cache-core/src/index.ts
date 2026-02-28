/**
 * Cache storage contract for get/set/delete/clear operations.
 */
export type { CacheStore } from './libs/CacheStore';

/**
 * Method decorator that caches method return values.
 */
export { Cacheable, type CacheableOptions } from './libs/decorators/Cacheable';

/**
 * Method decorator that evicts cache entries by key or pattern.
 */
export { CacheEvict, type CacheEvictOptions } from './libs/decorators/CacheEvict';

/**
 * Default in-memory cache store implementation.
 */
export { InMemoryCacheStore } from './libs/InMemoryCacheStore';
