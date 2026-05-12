import { Token } from "@croco/framework-context";
import type {
  IndexConfig,
  SearchDocument,
  SearchEngineCapabilities,
  SearchQuery,
  SearchResult,
} from "./types";

/**
 * 검색 엔진 추상 클래스
 *
 * @description
 * 특정 검색 엔진 구현(Elasticsearch, OpenSearch, Typesense 등)의 추상화 계층입니다.
 * Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.
 */
export abstract class SearchEngine {
  static readonly token = new Token<SearchEngine>("SearchEngine");

  /**
   * 검색 엔진 기능 플래그
   */
  abstract readonly capabilities: SearchEngineCapabilities;

  /**
   * 검색 실행
   *
   * @param index - 인덱스 이름
   * @param query - 검색 쿼리
   * @returns 검색 결과
   */
  abstract search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>>;

  /**
   * 문서 인덱싱
   *
   * @param index - 인덱스 이름
   * @param document - 인덱싱할 문서
   */
  abstract indexDocument(index: string, document: SearchDocument): Promise<void>;

  /**
   * 문서 삭제
   *
   * @param index - 인덱스 이름
   * @param documentId - 문서 ID
   */
  abstract deleteDocument(index: string, documentId: string): Promise<void>;

  /**
   * 대량 문서 인덱싱
   *
   * @param index - 인덱스 이름
   * @param documents - 인덱싱할 문서 목록
   */
  abstract bulkIndex(index: string, documents: SearchDocument[]): Promise<void>;

  /**
   * 인덱스 생성
   *
   * @param config - 인덱스 설정
   */
  abstract createIndex(config: IndexConfig): Promise<void>;

  /**
   * 인덱스 삭제
   *
   * @param name - 인덱스 이름
   */
  abstract deleteIndex(name: string): Promise<void>;
}
