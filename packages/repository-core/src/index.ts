/**
 * Read-only repository contract for fetching entities by single or multiple IDs.
 */

export { BatchLoad } from './libs/decorators/BatchLoad';
export type { BatchLoaderFactoryOptions, BatchLoaderLike, IBatchLoaderFactory } from './libs/IBatchLoaderFactory';
export { BATCH_LOADER_FACTORY_TOKEN } from './libs/IBatchLoaderFactory';
export * from './libs/ReadRepository';
/**
 * Unified repository contract that combines read and write capabilities.
 */
export * from './libs/Repository';
/**
 * Write-only repository contract for saving and deleting entities.
 */
export * from './libs/WriteRepository';
