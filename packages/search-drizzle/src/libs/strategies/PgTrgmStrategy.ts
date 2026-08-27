import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from "@croco/search-core";
import { type SQL, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { SEARCH_SCORE_ALIAS } from "../searchScore";
import type { SearchStrategy } from "../types";

/**
 * `pg_trgm` 확장을 이용한 유사도 검색 전략입니다.
 */
export class PgTrgmStrategy implements SearchStrategy {
  private readonly similarityThreshold: number;

  /**
   * 유사도 임계값 설정으로 전략을 초기화합니다.
   */
  constructor(options?: { threshold?: number }) {
    this.similarityThreshold = options?.threshold ?? 0.3;
  }

  /**
   * trigram similarity 기반 검색 SQL을 생성합니다.
   */
  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SQL {
    const tableIdentifier = sql.identifier(table);
    const tenantIdParam = sql.param(tenantId);
    const queryParam = sql.param(query.query);
    const thresholdParam = sql.param(this.similarityThreshold);
    const scoreAlias = sql.identifier(SEARCH_SCORE_ALIAS);
    const scoreExpression = sql`similarity("search_vector", ${queryParam})`;

    return sql`
      SELECT *, ${scoreExpression} AS ${scoreAlias} FROM ${tableIdentifier}
      WHERE "tenant_id" = ${tenantIdParam}
      AND ${scoreExpression} > ${thresholdParam}
      ORDER BY ${scoreExpression} DESC
    `;
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
    return ["pg_trgm"];
  }

  /**
   * 현재 DB가 `pg_trgm` 확장을 지원하는지 확인합니다.
   */
  async checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`);
    return result.rows.length > 0;
  }

  /**
   * 이 전략이 제공하는 검색 기능을 반환합니다.
   */
  getCapabilities(): SearchEngineCapabilities {
    return {
      facetedSearch: false,
      highlightSearch: false,
      vectorSearch: false,
      fuzzySearch: true,
    };
  }
}
