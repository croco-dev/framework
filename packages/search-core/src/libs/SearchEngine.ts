import { Token } from "@croco/framework-context";
import type {
  SearchIndexDocument,
  SearchIndexQuery,
  SearchIndexQueryInput,
  SearchIndexRef,
} from "./SearchIndexRef";
import type {
  IndexConfig,
  SearchDocument,
  SearchEngineCapabilities,
  SearchOperationOptions,
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
  abstract search<T>(
    index: string,
    query: SearchQuery,
    options?: SearchOperationOptions,
  ): Promise<SearchResult<T>>;

  /**
   * 타입이 지정된 인덱스 참조로 검색을 실행합니다.
   */
  searchIndex<
    TReference extends SearchIndexRef,
    const TQuery extends SearchIndexQuery<NoInfer<TReference>>,
  >(
    index: TReference,
    query: TQuery & SearchIndexQueryInput<TReference, TQuery>,
    options?: SearchOperationOptions,
  ): Promise<SearchResult<SearchIndexDocument<TReference>>> {
    return this.search<SearchIndexDocument<TReference>>(index.name, query, options);
  }

  /**
   * 문서 인덱싱
   *
   * @param index - 인덱스 이름
   * @param document - 인덱싱할 문서
   */
  abstract indexDocument(
    index: string,
    document: SearchDocument,
    options?: SearchOperationOptions,
  ): Promise<void>;

  /**
   * 타입이 지정된 인덱스 참조에 문서를 인덱싱합니다.
   */
  indexDocumentAt<TReference extends SearchIndexRef>(
    index: TReference,
    document: SearchIndexDocument<TReference>,
    options?: SearchOperationOptions,
  ): Promise<void> {
    return this.indexDocument(index.name, document as SearchDocument, options);
  }

  /**
   * 문서 삭제
   *
   * @param index - 인덱스 이름
   * @param documentId - 문서 ID
   */
  abstract deleteDocument(
    index: string,
    documentId: string,
    options?: SearchOperationOptions,
  ): Promise<void>;

  /**
   * 대량 문서 인덱싱
   *
   * @param index - 인덱스 이름
   * @param documents - 인덱싱할 문서 목록
   */
  abstract bulkIndex(
    index: string,
    documents: SearchDocument[],
    options?: SearchOperationOptions,
  ): Promise<void>;

  /**
   * 타입이 지정된 인덱스 참조에 여러 문서를 인덱싱합니다.
   */
  bulkIndexAt<TReference extends SearchIndexRef>(
    index: TReference,
    documents: readonly SearchIndexDocument<TReference>[],
    options?: SearchOperationOptions,
  ): Promise<void> {
    return this.bulkIndex(index.name, [...documents] as SearchDocument[], options);
  }

  /**
   * 인덱스 생성
   *
   * @param config - 인덱스 설정
   */
  abstract createIndex(config: IndexConfig, options?: SearchOperationOptions): Promise<void>;

  /**
   * 인덱스 삭제
   *
   * @param name - 인덱스 이름
   */
  abstract deleteIndex(name: string, options?: SearchOperationOptions): Promise<void>;
}
