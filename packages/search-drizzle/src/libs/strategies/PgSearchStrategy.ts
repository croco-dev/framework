import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from "@croco/search-core";
import { type SQL, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { buildPostgresSearchQueryPlan } from "../searchQueryPlan";
import type { SearchQueryPlan, SearchStrategy } from "../types";

/**
 * `pg_search` 확장을 이용한 전문 검색 전략입니다.
 */
export class PgSearchStrategy implements SearchStrategy {
  private readonly indexName?: string;

  /**
   * 선택적 인덱스 이름 설정으로 전략을 초기화합니다.
   */
  constructor(options?: { indexName?: string }) {
    this.indexName = options?.indexName;
  }

  /**
   * `pg_search` 문법을 사용하는 검색 SQL을 생성합니다.
   */
  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SearchQueryPlan {
    const idIdentifier = sql.identifier("id");
    const scoreExpression = sql`paradedb.score(${idIdentifier})`;
    return buildPostgresSearchQueryPlan({
      table,
      query,
      tenantId,
      scoreExpression,
      searchPredicate: sql`${sql.identifier(table)} @@@ ${sql.param(query.query)}`,
    });
  }

  /**
   * 문서를 테이블에 삽입하는 SQL을 생성합니다.
   */
  buildIndexQuery(table: string, document: SearchDocument, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);

    const columns = Object.keys(document).concat("tenant_id");
    const values = Object.values(document).concat(tenantId);

    const columnChunks = sql.join(
      columns.map((c) => sql.identifier(c)),
      sql`, `,
    );
    const valueChunks = sql.join(
      values.map((v) => sql.param(v)),
      sql`, `,
    );

    return sql`INSERT INTO ${tableIdentifier} (${columnChunks}) VALUES (${valueChunks})`;
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
    return ["pg_search"];
  }

  /**
   * 현재 DB가 `pg_search` 확장을 지원하는지 확인합니다.
   */
  async checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'pg_search'`);
    return result.rows.length > 0;
  }

  /**
   * 이 전략이 제공하는 검색 기능을 반환합니다.
   */
  getCapabilities(): SearchEngineCapabilities {
    return {
      facetedSearch: true,
      highlightSearch: true,
      vectorSearch: false,
      fuzzySearch: true,
    };
  }
}
