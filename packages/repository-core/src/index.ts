/**
 * Read-only repository contract for fetching entities by single or multiple IDs.
 */

export { BatchLoad } from "./libs/decorators/BatchLoad";
export { BATCH_LOADER_FACTORY_TOKEN } from "./libs/IBatchLoaderFactory";
export {
  BatchLoadDuplicateResultKeyProblem,
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
  BatchLoadResultIdentityMismatchProblem,
  BatchLoaderScopeCollisionProblem,
  BatchLoadUnexpectedResultKeyProblem,
  BatchLoadUnkeyedResultProblem,
} from "./libs/problems/BatchLoadProblems";
export * from "./libs/ReadRepository";
/**
 * Unified repository contract that combines read and write capabilities.
 */
export * from "./libs/Repository";
/**
 * Write-only repository contract for saving and deleting entities.
 */
export * from "./libs/WriteRepository";
export type {
  BatchLoadOptions,
  BatchLoadScope,
  BatchLoadScopeResolver,
} from "./libs/decorators/BatchLoad";
export type {
  BatchLoaderFactoryOptions,
  BatchLoaderLike,
  IBatchLoaderFactory,
} from "./libs/IBatchLoaderFactory";
export type { KeyedRepositoryResult } from "./libs/ReadRepository";
