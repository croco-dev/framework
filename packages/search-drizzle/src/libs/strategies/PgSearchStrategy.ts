import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from '@croco/search-core';
import { type SQL, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SearchStrategy } from '../types';

export class PgSearchStrategy implements SearchStrategy {
  private readonly indexName?: string;

  constructor(options?: { indexName?: string }) {
    this.indexName = options?.indexName;
  }

  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);
    const tenantIdParam = sql.param(tenantId);
    const queryParam = sql.param(query.query);
    const idIdentifier = sql.identifier('id');

    return sql`
      SELECT * FROM ${tableIdentifier}
      WHERE ${tableIdentifier} @@@ ${queryParam}
      AND "tenant_id" = ${tenantIdParam}
      ORDER BY paradedb.score(${idIdentifier}) DESC
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
    return ['pg_search'];
  }

  async checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'pg_search'`);
    return result.rows.length > 0;
  }

  getCapabilities(): SearchEngineCapabilities {
    return {
      facetedSearch: true,
      highlightSearch: true,
      vectorSearch: false,
      fuzzySearch: true,
    };
  }
}
