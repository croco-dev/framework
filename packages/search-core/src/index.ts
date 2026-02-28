/**
 * @packageDocumentation
 * 
 * # @croco/search-core
 * 
 * Core search abstraction layer for Croco framework.
 * Provides decorator-based metadata, search engine abstraction, and transform utilities.
 * 
 * @example
 * ```typescript
 * import { Searchable, SearchField } from '@croco/search-core';
 * 
 * @Searchable({ index: 'users', autoSync: true })
 * class User {
 *   @SearchField({ searchable: true, filterable: true })
 *   name!: string;
 * }
 * ```
 */

// Decorator Metadata Keys

// Events & Sync

export { SEARCH_FIELD_METADATA, SEARCHABLE_METADATA } from './libs/decorators/constants';
export type {
  SearchableMetadata,
  SearchableOptions,
} from './libs/decorators/Searchable';
// Decorators
export { getSearchableMetadata, isSearchable, Searchable } from './libs/decorators/Searchable';
export type {
  SearchFieldMetadata,
  SearchFieldOptions,
} from './libs/decorators/SearchField';
export { getSearchFieldsMetadata, SearchField } from './libs/decorators/SearchField';
export * from './libs/events';
// Problems
export {
  IndexNotFoundProblem,
  MissingTenantProblem,
  StrategyUnavailableProblem,
  TransformNotFoundProblem,
} from './libs/problems/SearchProblems';
// Engine
export { SearchEngine } from './libs/SearchEngine';
export type { SearchServiceDependencies } from './libs/SearchService';
export { SearchService } from './libs/SearchService';
export * from './libs/sync';
export type { DeriveOptions } from './libs/transforms/derive';
// Transforms
export { derive } from './libs/transforms/derive';
export { InMemorySearchTransformRegistry, SearchTransformRegistry } from './libs/transforms/SearchTransformRegistry';
export type { DecomposedOptions, InitialsOptions, RomanizedOptions } from './libs/transforms/textTransforms';
export { textTransforms } from './libs/transforms/textTransforms';
export type { SearchTransformAdapter, SearchTransformRef } from './libs/transforms/types';
// Types
export type {
  IndexConfig,
  SearchDerivedFieldConfig,
  SearchDocument,
  SearchEngineCapabilities,
  SearchFieldConfig,
  SearchHit,
  SearchQuery,
  SearchResult,
} from './libs/types';
