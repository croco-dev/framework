/**
 * Search Core 타입 정의
 *
 * 검색 엔진에 독립적인 추상화 계층 제공
 */

/**
 * 검색 쿼리
 */
export type SearchQuery = {
  query: string;
  filters?: Record<string, unknown>;
  sort?: { field: string; order: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
};

/**
 * 검색 엔진 I/O 호출에 공통으로 적용되는 실행 옵션입니다.
 */
export type SearchOperationOptions = {
  readonly signal?: AbortSignal;
};

/**
 * 취소할 수 있는 검색 엔진 I/O 연산입니다.
 */
export type SearchOperation =
  | "search"
  | "indexDocument"
  | "deleteDocument"
  | "bulkIndex"
  | "createIndex"
  | "deleteIndex";

/**
 * 검색 결과
 */
export type SearchResult<T> = {
  hits: SearchHit<T>[];
  total: number;
  query: SearchQuery;
  processingTimeMs: number;
};

/**
 * 개별 검색 히트
 */
export type SearchHit<T> = {
  document: T;
  score?: number;
  highlights?: Record<string, string[]>;
};

/**
 * 인덱싱 대상 문서
 */
export type SearchDocument = {
  id: string;
  tenantId: string;
  [key: string]: unknown;
};

/**
 * 인덱스 설정
 */
export type IndexConfig = {
  name: string;
  primaryKey?: string;
  searchableFields?: readonly string[];
  filterableFields?: readonly string[];
  sortableFields?: readonly string[];
};

/**
 * @SearchField 데코레이터 옵션
 */
export type SearchFieldConfig = {
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  derived?: SearchDerivedFieldConfig[];
};

/**
 * derive() 결과 필드 설정
 */
export type SearchDerivedFieldConfig = {
  transformId: string;
  as?: string;
  options?: Record<string, unknown>;
  filterable?: boolean;
  sortable?: boolean;
};

/**
 * 검색 엔진 기능 플래그
 */
export type SearchEngineCapabilities = {
  facetedSearch: boolean;
  vectorSearch: boolean;
  highlightSearch: boolean;
  fuzzySearch: boolean;
};
