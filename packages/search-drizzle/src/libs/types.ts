import type { SearchDocument, SearchEngineCapabilities, SearchQuery } from '@croco/search-core';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * 검색 엔진에서 Drizzle 클라이언트를 주입할 때 사용하는 토큰입니다.
 */
export const DRIZZLE_TOKEN = 'DRIZZLE_TOKEN';

/**
 * 검색 결과 행을 표현하는 공통 타입입니다.
 */
export type SearchResultRow = Record<string, unknown>;

/**
 * PostgreSQL 검색 전략이 구현해야 하는 계약입니다.
 */
export interface SearchStrategy {
  /**
   * 검색 SQL을 생성합니다.
   */
  buildSearchQuery(table: string, query: SearchQuery, tenantId: string): SQL;

  /**
   * 문서 색인 SQL을 생성합니다.
   */
  buildIndexQuery(table: string, document: SearchDocument, tenantId: string): SQL;

  /**
   * 문서 삭제 SQL을 생성합니다.
   */
  buildDeleteQuery(table: string, documentId: string, tenantId: string): SQL;

  /**
   * 전략 실행에 필요한 PostgreSQL 확장 목록을 반환합니다.
   */
  getRequiredExtensions(): string[];

  /**
   * 현재 DB가 전략을 지원하는지 확인합니다.
   */
  checkCapability(db: NodePgDatabase<Record<string, never>>): Promise<boolean>;

  /**
   * 전략이 제공하는 검색 기능을 반환합니다.
   */
  getCapabilities(): SearchEngineCapabilities;

  /**
   * 검색 결과 행을 도메인 문서 타입으로 변환합니다.
   */
  mapSearchRow?<T>(row: SearchResultRow): T;
}
