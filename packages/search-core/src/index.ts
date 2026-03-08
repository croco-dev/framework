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
/** @description Metadata key for storing Searchable and SearchField decorator data */
export { SEARCH_FIELD_METADATA, SEARCHABLE_METADATA } from './libs/decorators/constants';

/** @description Types for Searchable decorator configuration */
export type {
  SearchableMetadata,
  SearchableOptions,
} from './libs/decorators/Searchable';

// Decorators
/**
 * @description
 * Mark a class as searchable and configure its index behavior.
 *
 * @example
 * ```typescript
 * @Searchable({ index: 'products', autoSync: true })
 * class Product {
 *   @SearchField()
 *   name!: string;
 * }
 * ```
 */
export { getSearchableMetadata, isSearchable, Searchable } from './libs/decorators/Searchable';

/** @description Types for SearchField decorator configuration */
export type {
  SearchFieldMetadata,
  SearchFieldOptions,
} from './libs/decorators/SearchField';

/**
 * @description
 * Configure search field properties (searchable, filterable, sortable).
 *
 * @example
 * ```typescript
 * class User {
 *   @SearchField({ searchable: true, filterable: true, sortable: true })
 *   email!: string;
 * }
 * ```
 */
export { getSearchFieldsMetadata, SearchField } from './libs/decorators/SearchField';

/** @description Search-related domain events */
export * from './libs/events';

// Problems
/**
 * @description
 * Search-specific problem definitions for error handling.
 * - IndexNotFoundProblem: Index does not exist
 * - MissingTenantProblem: Tenant context not available
 * - StrategyUnavailableProblem: Requested search strategy not available
 * - TransformNotFoundProblem: Required transform function not found
 */
export {
  IndexNotFoundProblem,
  MissingTenantProblem,
  SearchCapabilityUnavailableProblem,
  StrategyUnavailableProblem,
  TransformNotFoundProblem,
} from './libs/problems/SearchProblems';

// Engine
/**
 * @description
 * Abstract base class for search engine implementations.
 * All concrete engines (Elasticsearch, Meilisearch, Drizzle, etc.) must extend this class.
 *
 * @example
 * ```typescript
 * class MySearchEngine extends SearchEngine {
 *   capabilities = { fullText: true, filtering: true, sorting: true };
 *
 *   async search(index, query) {
 *     // Implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export { SearchEngine } from './libs/SearchEngine';

/** @description Dependencies type for SearchService injection */
export type { SearchServiceDependencies } from './libs/SearchService';

/**
 * @description
 * High-level search service with automatic tenant isolation.
 * Wraps SearchEngine and adds tenantId filtering from Context.
 *
 * @example
 * ```typescript
 * const service = new SearchService({ engine: myEngine });
 * await service.search('users', { query: 'john' });
 * // Automatically filters by current tenant
 * ```
 */
export { SearchService } from './libs/SearchService';

/** @description Index synchronization utilities */
export * from './libs/sync';

/** @description Options for derive transform function */
export type { DeriveOptions } from './libs/transforms/derive';

// Transforms
/**
 * @description
 * Create derived search fields from existing data.
 * Useful for ngram, decomposition, romanization, etc.
 *
 * @example
 * ```typescript
 * @SearchField({
 *   derived: [
 *     derive({ type: 'ngram', min: 2, max: 4, source: 'name' })
 *   ]
 * })
 * name!: string;
 * ```
 */
export { derive } from './libs/transforms/derive';

/**
 * @description
 * Registry for managing search transform functions.
 * InMemorySearchTransformRegistry is the default implementation.
 */
export { InMemorySearchTransformRegistry, SearchTransformRegistry } from './libs/transforms/SearchTransformRegistry';

/** @description Configuration options for text transforms */
export type { DecomposedOptions, InitialsOptions, RomanizedOptions } from './libs/transforms/textTransforms';

/**
 * @description
 * Built-in text transformation utilities for Korean text.
 * Includes ngram, decomposition (choseong/jungseong/jongseong), initials, and romanization.
 *
 * @example
 * ```typescript
 * textTransforms.ngram('안녕하세요', { min: 2, max: 3 });
 * // ['안녕', '녕하', '하세요', '안녕하']
 * ```
 */
export { textTransforms } from './libs/transforms/textTransforms';

/** @description Transform registry and reference types */
export type { SearchTransformAdapter, SearchTransformRef } from './libs/transforms/types';

// Types
/**
 * @description
 * Core type definitions for search functionality.
 * - IndexConfig: Search index configuration
 * - SearchDerivedFieldConfig: Derived field configuration
 * - SearchDocument: Document structure with tenantId
 * - SearchEngineCapabilities: Supported features
 * - SearchFieldConfig: Field-level options
 * - SearchHit: Individual search result
 * - SearchQuery: Query parameters
 * - SearchResult: Search response with hits
 */
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
