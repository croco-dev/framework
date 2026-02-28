import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from '@croco/search-core';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const DRIZZLE_TOKEN = 'DRIZZLE_TOKEN';

export type SearchResultRow = Record<string, unknown>;

export interface SearchStrategy {
  /**
   * Build a SQL query for searching
   */
  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SQL;

  /**
   * Build a SQL query for indexing a document
   */
  buildIndexQuery(table: string, document: SearchDocument, tenantId: string): SQL;

  /**
   * Build a SQL query for deleting a document
   */
  buildDeleteQuery(table: string, documentId: string, tenantId: string): SQL;

  /**
   * Get required PostgreSQL extensions for this strategy
   */
  getRequiredExtensions(): string[];

  /**
   * Check if the database supports this strategy
   */
  checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean>;

  /**
   * Get capabilities of this strategy
   */
  getCapabilities(): SearchEngineCapabilities;

  mapSearchRow?<T>(row: SearchResultRow): T;
}
