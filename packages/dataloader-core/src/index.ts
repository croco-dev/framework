/**
 * @packageDocumentation
 *
 * DataLoader implementation for batching and caching requests.
 *
 * This package provides a request-scoped DataLoader that automatically batches
 * individual loads into a single batch request, and caches results to avoid
 * redundant loading.
 *
 * @example
 * ```typescript
 * import { createBatchLoader } from '@croco/dataloader-core';
 *
 * const userLoader = createBatchLoader({
 *   name: 'user',
 *   batchFn: async (ids) => {
 *     const users = await db.users.findMany({ where: { id: { in: ids } } });
 *     return ids.map(id => users.find(u => u.id === id) || null);
 *   },
 * });
 *
 * // Automatically batches multiple loads in the same tick
 * const [user1, user2] = await Promise.all([
 *   userLoader.load('1'),
 *   userLoader.load('2'),
 * ]);
 * ```
 *
 * @package @croco/dataloader-core
 */

/**
 * Creates a request-scoped batch loader.
 *
 * The returned loader automatically batches individual load calls into a single batch
 * request, and caches results per request context. This is especially useful for
 * resolving the N+1 query problem in GraphQL or other data-fetching scenarios.
 *
 * @description
 * The loader is scoped to the current request context using AsyncLocalStorage.
 * Within a request, multiple load calls are automatically batched, and results
 * are cached to avoid redundant batch requests.
 *
 * @template K - The type of keys (e.g., string ID, composite key)
 * @template V - The type of loaded values
 *
 * @param options - Configuration options for the batch loader
 * @param options.name - Unique name for caching the loader instance in request context
 * @param options.batchFn - Function that loads data for multiple keys at once
 * @param options.maxBatchSize - Maximum items per batch (default: Infinity)
 * @param options.cache - Whether to cache results (default: true)
 * @param options.scope - Static scope for cache isolation (e.g., tenantId)
 * @param options.resolveScope - Dynamic scope function for transaction-aware caching
 *
 * @returns A BatchLoader instance with load, loadMany, clear, clearAll, and prime methods
 *
 * @example
 * ```typescript
 * // Basic usage with database IDs
 * const loader = createBatchLoader<User, string>({
 *   name: 'users',
 *   batchFn: async (ids) => {
 *     const users = await db.users.findByIds(ids);
 *     return ids.map(id => users.get(id) ?? null);
 *   },
 * });
 *
 * const user = await loader.load('user-123');
 * ```
 *
 * @example
 * ```typescript
 * // With transaction-aware scoping
 * const orderLoader = createBatchLoader<Order, string>({
 *   name: 'orders',
 *   batchFn: async (ids) => await fetchOrders(ids),
 *   resolveScope: () => TransactionContext.get()?.id,
 * });
 * ```
 */
export { createBatchLoader } from './libs/createBatchLoader';
/**
 * Batch function type for loading multiple values.
 *
 * @description
 * A function that receives an array of keys and returns a Promise that resolves
 * to an array of values. The returned array must be the same length as the input
 * keys array, with each value corresponding to the key at the same index.
 *
 * Values can be:
 * - The loaded value (V)
 * - null if the key was not found
 * - Error if the load failed for that specific key
 *
 * @template K - The type of keys
 * @template V - The type of successfully loaded values
 *
 * @param keys - Readonly array of keys to load
 * @returns Promise resolving to an array of values, errors, or null
 *
 * @example
 * ```typescript
 * const batchFn: BatchFn<string, User> = async (ids) => {
 *   const users = await db.users.findMany({ where: { id: { in: ids } } });
 *   return ids.map(id => users.find(u => u.id === id) || null);
 * };
 * ```
 */
/**
 * Batch loader instance interface.
 *
 * @description
 * Provides methods for loading individual items, loading multiple items,
 * clearing cache entries, and priming the cache.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
/**
 * Configuration options for creating a batch loader.
 *
 * @description
 * Defines the configuration for a batch loader including the batch function,
 * caching behavior, and scoping options.
 *
 * @template K - The type of keys
 * @template V - The type of loaded values
 *
 * @property name - Unique identifier for caching the loader in request context
 * @property batchFn - Function that batches multiple keys into a single load operation
 * @property maxBatchSize - Optional maximum number of items per batch (default: Infinity)
 * @property cache - Optional flag to enable/disable result caching (default: true)
 * @property scope - Optional static scope for cache isolation (e.g., tenant ID)
 * @property resolveScope - Optional function for dynamic scope resolution (e.g., transaction ID)
 *
 * @example
 * ```typescript
 * const options: BatchLoaderOptions<string, User> = {
 *   name: 'users',
 *   batchFn: async (ids) => await fetchUsers(ids),
 *   maxBatchSize: 100,
 *   cache: true,
 *   scope: 'tenant-123',
 * };
 * ```
 */
export type { BatchFn, BatchLoader, BatchLoaderOptions } from './libs/types';
