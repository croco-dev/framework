/**
 * @packageDocumentation
 *
 * 검색 엔진 추상화, 검색 메타데이터, 자동 동기화, 텍스트 변환을 제공하는 검색 코어 패키지입니다.
 */

/**
 * 검색 데코레이터 메타데이터 키입니다.
 */
export { SEARCH_FIELD_METADATA, SEARCHABLE_METADATA } from "./libs/decorators/constants";

/**
 * 검색 대상 클래스에 사용하는 메타데이터와 옵션 타입입니다.
 */
export type { SearchableMetadata, SearchableOptions } from "./libs/decorators/Searchable";

/**
 * 클래스를 검색 인덱스와 연결하는 데코레이터와 메타데이터 조회 유틸리티입니다.
 */
export { getSearchableMetadata, isSearchable, Searchable } from "./libs/decorators/Searchable";

/**
 * 검색 필드 옵션과 메타데이터 타입입니다.
 */
export type { SearchFieldMetadata, SearchFieldOptions } from "./libs/decorators/SearchField";

/**
 * 필드별 검색 옵션을 선언하는 데코레이터와 메타데이터 조회 유틸리티입니다.
 */
export { getSearchFieldsMetadata, SearchField } from "./libs/decorators/SearchField";

/**
 * 검색 인덱스 동기화와 삭제 흐름에서 사용하는 이벤트입니다.
 */
export * from "./libs/events";

/**
 * 검색 과정에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  IndexNotFoundProblem,
  MissingTenantProblem,
  SearchCapabilityUnavailableProblem,
  SearchSyncIdentityConflictProblem,
  StrategyUnavailableProblem,
  TransformNotFoundProblem,
} from "./libs/problems/SearchProblems";

/**
 * 검색 엔진 구현이 따라야 하는 추상 계약입니다.
 */
export { SearchEngine } from "./libs/SearchEngine";

/**
 * SearchService 생성에 필요한 의존성 타입입니다.
 */
export type { SearchServiceDependencies } from "./libs/SearchService";

/**
 * tenant 격리를 자동 적용하는 상위 검색 서비스입니다.
 */
export { SearchService } from "./libs/SearchService";

/**
 * 검색 이벤트 기반 자동 동기화 기능입니다.
 */
export * from "./libs/sync";

/**
 * 파생 필드 구성을 위한 derive 옵션 타입입니다.
 */
export type { DeriveOptions } from "./libs/transforms/derive";

/**
 * 검색용 파생 필드 구성을 생성하는 유틸리티입니다.
 */
export { derive } from "./libs/transforms/derive";

/**
 * 검색 변환 어댑터 레지스트리와 기본 인메모리 구현체입니다.
 */
export {
  InMemorySearchTransformRegistry,
  SearchTransformRegistry,
} from "./libs/transforms/SearchTransformRegistry";

/**
 * 한국어 텍스트 변환 옵션 타입입니다.
 */
export type {
  DecomposedOptions,
  InitialsOptions,
  RomanizedOptions,
} from "./libs/transforms/textTransforms";

/**
 * ngram, 자모 분해, 초성, 로마자 변환을 제공하는 텍스트 유틸리티입니다.
 */
export { textTransforms } from "./libs/transforms/textTransforms";

/**
 * 검색 변환 어댑터와 참조 타입입니다.
 */
export type { SearchTransformAdapter, SearchTransformRef } from "./libs/transforms/types";

/**
 * 검색 인덱스, 문서, 질의, 결과에 사용하는 핵심 타입입니다.
 */
export type {
  IndexConfig,
  SearchDerivedFieldConfig,
  SearchDocument,
  SearchEngineCapabilities,
  SearchFieldConfig,
  SearchHit,
  SearchQuery,
  SearchResult,
} from "./libs/types";

export type { SearchSyncIdentityConflictSource } from "./libs/problems/SearchProblems";
