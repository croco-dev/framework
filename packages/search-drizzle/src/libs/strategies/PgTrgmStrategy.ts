import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from '@croco/search-core';
import { type SQL, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SearchStrategy } from '../types';

export class PgTrgmStrategy implements SearchStrategy {
  private readonly similarityThreshold: number;

  constructor(options?: { threshold?: number }) {
    this.similarityThreshold = options?.threshold ?? 0.3;
  }

  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);
    const tenantIdParam = sql.param(tenantId);
    const queryParam = sql.param(query.query);
    const thresholdParam = sql.param(this.similarityThreshold);

    return sql`
      SELECT * FROM ${tableIdentifier}
      WHERE "tenant_id" = ${tenantIdParam}
      AND similarity("search_vector", ${queryParam}) > ${thresholdParam}
      ORDER BY similarity("search_vector", ${queryParam}) DESC
    `;
  }

  buildIndexQuery(table: string, document: SearchDocument, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);

    const columns = Object.keys(document).concat('tenant_id');
    const values = Object.values(document).concat(tenantId);

    const columnChunks = sql.join(
      columns.map((c) => sql.identifier(c)),
      sql`, `
    );
    const valueChunks = sql.join(
      values.map((v) => sql.param(v)),
      sql`, `
    );

    return sql`INSERT INTO ${tableIdentifier} (${columnChunks}) VALUES (${valueChunks})`;
  }

  buildDeleteQuery(table: string, documentId: string, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);
    const idParam = sql.param(documentId);
    const tenantIdParam = sql.param(tenantId);

    return sql`DELETE FROM ${tableIdentifier} WHERE "id" = ${idParam} AND "tenant_id" = ${tenantIdParam}`;
  }

  getRequiredExtensions(): string[] {
    return ['pg_trgm'];
  }

  async checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`);
    return result.rows.length > 0;
  }

  getCapabilities(): SearchEngineCapabilities {
    return {
      facetedSearch: false,
      highlightSearch: false,
      vectorSearch: false,
      fuzzySearch: true,
    };
  }
}
