import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from "@croco/search-core";
import { type SQL, sql } from "drizzle-orm";
import {
  buildPostgresDocumentBulkUpsertQueryPlans,
  buildPostgresDocumentUpsertQuery,
} from "../postgresDocumentIndex";
import { buildPostgresSearchQueryPlan } from "../searchQueryPlan";
import type {
  BulkIndexQueryPlan,
  DrizzleSearchDatabase,
  SearchQueryPlan,
  SearchStrategy,
} from "../types";

/**
 * `pgroonga` 확장을 이용한 고성능 검색 전략입니다.
 */
export class PGroongaStrategy implements SearchStrategy {
  /**
   * PGroonga 연산자를 사용하는 검색 SQL을 생성합니다.
   */
  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SearchQueryPlan {
    const scoreExpression = sql`pgroonga_score(tableoid, ctid)`;
    return buildPostgresSearchQueryPlan({
      table,
      query,
      tenantId,
      scoreExpression,
      searchPredicate: sql`${sql.identifier("search_vector")} &@~ ${sql.param(query.query)}`,
    });
  }

  /**
   * 문서를 테넌트 범위에서 upsert하는 SQL을 생성합니다.
   */
  buildIndexQuery(table: string, document: SearchDocument, tenantId: string): SQL {
    return buildPostgresDocumentUpsertQuery(table, document, tenantId);
  }

  /**
   * 문서를 bounded PostgreSQL upsert query plan으로 구성합니다.
   */
  buildBulkIndexQueryPlans(
    table: string,
    documents: readonly SearchDocument[],
    tenantId: string,
  ): readonly BulkIndexQueryPlan[] {
    return buildPostgresDocumentBulkUpsertQueryPlans(table, documents, tenantId);
  }

  /**
   * 문서 삭제 SQL을 생성합니다.
   */
  buildDeleteQuery(table: string, documentId: string, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);
    const idParam = sql.param(documentId);
    const tenantIdParam = sql.param(tenantId);

    return sql`DELETE FROM ${tableIdentifier} WHERE "id" = ${idParam} AND "tenant_id" = ${tenantIdParam}`;
  }

  /**
   * 전략에 필요한 PostgreSQL 확장 목록을 반환합니다.
   */
  getRequiredExtensions(): string[] {
    return ["pgroonga"];
  }

  /**
   * 현재 DB가 `pgroonga` 확장을 지원하는지 확인합니다.
   */
  async checkCapability(db: DrizzleSearchDatabase): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'pgroonga'`);
    return result.rows.length > 0;
  }

  /**
   * 이 전략이 제공하는 검색 기능을 반환합니다.
   */
  getCapabilities(): SearchEngineCapabilities {
    return {
      facetedSearch: false,
      highlightSearch: true,
      vectorSearch: false,
      fuzzySearch: true,
    };
  }
}
