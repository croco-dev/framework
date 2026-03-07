/**
 * @packageDocumentation
 *
 * # @croco/search-drizzle
 *
 * Drizzle ORM-based search engine implementation for Croco framework.
 * Provides PostgreSQL full-text search using different strategies (pg_trgm, pg_search, PGroonga).
 *
 * @example
 * ```typescript
 * import { DrizzleSearchEngine, PgTrgmStrategy } from '@croco/search-drizzle';
 * import { DRIZZLE_TOKEN } from '@croco/search-drizzle';
 *
 * // Register strategy
 * Container.set(DRIZZLE_TOKEN, db);
 *
 * const engine = new DrizzleSearchEngine(db, new PgTrgmStrategy());
 * await engine.search('users', { query: 'john' });
 * ```
 */

/**
 * @description
 * Drizzle-based search engine implementation.
 * Extends SearchEngine and provides PostgreSQL full-text search capabilities.
 * Supports multiple strategies with automatic capability detection.
 *
 * @example
 * ```typescript
 * const engine = new DrizzleSearchEngine(db, new PgTrgmStrategy());
 * await engine.search('products', { query: 'laptop' });
 * ```
 */
export * from './libs/DrizzleSearchEngine';
export * from './libs/problems/InvalidSearchRowProblem';

/**
 * @description
 * PostgreSQL search strategies for different full-text search implementations.
 *
 * Available strategies:
 * - PgTrgmStrategy: Uses pg_trgm extension for trigram-based search (always available)
 * - PgSearchStrategy: Uses pg_search extension for advanced full-text search
 * - PGroongaStrategy: Uses PGroonga for high-performance full-text search
 *
 * @example
 * ```typescript
 * import { PgTrgmStrategy, PgSearchStrategy, PGroongaStrategy } from '@croco/search-drizzle';
 *
 * const strategy = new PgTrgmStrategy(); // Default, works everywhere
 * const engine = new DrizzleSearchEngine(db, strategy);
 * ```
 */
export * from './libs/strategies';

/**
 * @description
 * Type definitions for Drizzle search integration.
 * - DRIZZLE_TOKEN: DI token for Drizzle database instance
 * - SearchStrategy: Interface for search strategy implementations
 *
 * @example
 * ```typescript
 * import { DRIZZLE_TOKEN } from '@croco/search-drizzle';
 *
 * @Inject(DRIZZLE_TOKEN) db: NodePgDatabase
 * ```
 */
export * from './libs/types';
