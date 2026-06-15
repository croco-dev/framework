/**
 * @packageDocumentation
 *
 * 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷 기반 레이트 리밋 기능을 제공하는 코어 패키지입니다.
 */

/**
 * 메서드에 레이트 리밋 정책을 선언하는 데코레이터와 옵션 타입입니다.
 */
export { RateLimit, type RateLimitDecoratorOptions } from "./libs/decorators/RateLimit";

/**
 * 라우트 실행 시 레이트 리밋을 검사하는 가드와 메타데이터 타입입니다.
 */
export {
  type GuardContext,
  RATE_LIMIT_METADATA_KEY,
  RateLimitGuard,
  type RateLimitMetadata,
  ROUTE_GUARDS_METADATA_KEY,
} from "./libs/guards/RateLimitGuard";

/**
 * 메모리 기반 레이트 리밋 저장소 구현체들입니다.
 */
export {
  FixedWindowInMemoryStore,
  type InMemoryRateLimitStoreOptions,
  SlidingWindowInMemoryStore,
  TokenBucketInMemoryStore,
} from "./libs/InMemoryRateLimitStore";

/**
 * HTTP 미들웨어 형태로 레이트 리밋을 적용하는 헬퍼와 타입입니다.
 */
export {
  type CreateMiddlewareOptions,
  createRateLimitMiddleware,
  type HttpContext,
  type MiddlewareFunction,
  type RateLimitHeaders,
} from "./libs/middleware/rateLimitMiddleware";

/**
 * 레이트 리밋 설정 오류에 사용하는 Problem 타입입니다.
 */
export {
  RateLimitKeyBuilderProblem,
  RateLimitWindowProblem,
} from "./libs/problems/RateLimitConfigProblems";

/**
 * 요청 한도 초과 시 사용하는 Problem 타입입니다.
 */
export { RateLimitExceededProblem } from "./libs/problems/RateLimitExceededProblem";

/**
 * 레이트 리밋 정책 생성 함수와 핵심 RateLimiter 클래스입니다.
 */
export {
  createFixedWindowPolicy,
  createSlidingWindowPolicy,
  createTokenBucketPolicy,
  RateLimiter,
  type RateLimiterContext,
  type RateLimiterKeyBuilder,
} from "./libs/RateLimiter";

/**
 * 레이트 리밋 키 구성에 사용하는 타입과 키 빌더입니다.
 */
export { type KeyContext, type KeySegment, RateLimitKeyBuilder } from "./libs/RateLimitKeyBuilder";

/**
 * 분산 저장소와 알고리즘별 저장소 추상 계약입니다.
 */
export {
  DistributedRateLimitStore,
  type DistributedRateLimitStoreOptions,
  FixedWindowStore,
  type RateLimitEntry,
  RateLimitStore,
  type SlidingWindowEntry,
  SlidingWindowStore,
  type TokenBucketEntry,
  TokenBucketStore,
} from "./libs/RateLimitStore";

/**
 * 정책, 결과, 통계, 타입 가드에 사용하는 핵심 타입과 유틸리티입니다.
 */
export {
  type FixedWindowPolicy,
  isFixedWindowPolicy,
  isSlidingWindowPolicy,
  isTokenBucketPolicy,
  parseWindowMs,
  type RateLimitAlgorithm,
  type RateLimitMiddlewareOptions,
  type RateLimitPolicy,
  type RateLimitResult,
  type RateLimitStatsError,
  type RateLimitStats,
  type SlidingWindowPolicy,
  type TokenBucketPolicy,
} from "./libs/types";
