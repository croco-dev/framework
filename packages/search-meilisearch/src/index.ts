/**
 * @packageDocumentation
 *
 * # @croco/search-meilisearch
 *
 * Meilisearch engine implementation for Croco framework.
 * Provides high-performance full-text search with tenant isolation via tenant tokens.
 *
 * @example
 * ```typescript
 * import { MeilisearchEngine } from '@croco/search-meilisearch';
 *
 * const engine = new MeilisearchEngine({
 *   host: 'http://localhost:7700',
 *   apiKey: 'master-key',
 *   tenantTokenOptions: {
 *     apiKeyUid: 'uid',
 *     expiresIn: 3600,
 *   },
 * });
 *
 * await engine.search('products', { query: 'laptop' });
 * ```
 */

/**
 * @description
 * Meilisearch-based search engine implementation.
 * Extends SearchEngine with Meilisearch-specific features:
 * - Automatic tenant isolation via _tenantId field
 * - Tenant token generation for multi-tenant applications
 * - Faceted search, fuzzy search, and highlight support
 *
 * @example
 * ```typescript
 * const engine = new MeilisearchEngine({
 *   host: 'https://search.meilisearch.io',
 *   apiKey: 'master-key',
 * });
 *
 * await engine.search('users', {
 *   query: 'john',
 *   filters: { role: 'admin' },
 *   limit: 10,
 * });
 * ```
 */
export * from './libs/MeilisearchEngine';

/**
 * @description
 * Meilisearch-specific problem definitions.
 * - TenantTokenNotConfiguredProblem: Tenant token options not configured
 *
 * @example
 * ```typescript
 * try {
 *   const token = await engine.generateTenantToken('tenant-123');
 * } catch (e) {
 *   if (e instanceof TenantTokenNotConfiguredProblem) {
 *     // Handle missing configuration
 *   }
 * }
 * ```
 */
export { TenantTokenNotConfiguredProblem } from './libs/problems/MeilisearchProblems';

/**
 * @description
 * Type definitions for Meilisearch integration.
 * - MeilisearchEngineOptions: Configuration options for the engine
 * - TenantTokenOptions: Options for generating tenant tokens
 *
 * @example
 * ```typescript
 * import type { MeilisearchEngineOptions, TenantTokenOptions } from '@croco/search-meilisearch';
 *
 * const options: MeilisearchEngineOptions = {
 *   host: 'http://localhost:7700',
 *   apiKey: 'master-key',
 *   tenantTokenOptions: {
 *     apiKeyUid: 'uid',
 *     expiresIn: 3600, // 1 hour
 *   },
 * };
 * ```
 */
export type * from './libs/types';
