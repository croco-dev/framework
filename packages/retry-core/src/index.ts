/**
 * 재시도 간격을 계산하는 백오프 정책 계약과 옵션 타입입니다.
 */
export type { BackoffDependencies, BackoffOptions, BackoffPolicy } from "./libs/BackoffPolicy";

/**
 * 지수형, 고정형, 무지연 재시도를 위한 기본 백오프 구현체입니다.
 */
export { ExponentialBackoff, FixedBackoff, NoBackoff } from "./libs/BackoffPolicy";

/**
 * 서킷 브레이커를 구성할 때 사용하는 옵션 타입입니다.
 */
export type { CircuitBreakerFallback, CircuitBreakerOptions } from "./libs/CircuitBreaker";

/**
 * 불안정한 의존성 호출을 차단하고 복구를 조율하는 서킷 브레이커 구현체입니다.
 */
export { CircuitBreaker } from "./libs/CircuitBreaker";

/**
 * 재시도와 서킷 브레이커 보호를 함께 적용하는 템플릿입니다.
 */
export { CircuitBreakerRetryTemplate } from "./libs/CircuitBreakerRetryTemplate";
export type {
  CircuitStateTransition,
  InMemoryCircuitBreakerStateStoreOptions,
} from "./libs/CircuitBreakerState";
/**
 * 서킷 상태 저장소 계약과 메모리 구현체, 상태 판별 유틸리티입니다.
 */
export {
  CircuitBreakerStateStore,
  CircuitState,
  InMemoryCircuitBreakerStateStore,
} from "./libs/CircuitBreakerState";

export type {
  OnStoreError,
  RedisCircuitBreakerStoreOptions,
} from "./libs/stores/RedisCircuitBreakerStore";
export { RedisCircuitBreakerStore } from "./libs/stores/RedisCircuitBreakerStore";

/**
 * 재시도 차단, 소진, 복구 충돌 시 발생하는 Problem 타입들입니다.
 */
export {
  CircuitBreakerOpenProblem,
  DuplicateRecoverHandlerProblem,
  InvalidRetryConfigurationProblem,
  LambdaTimeoutProblem,
  RetryAbortedProblem,
  RetryCancellationUnsupportedProblem,
  RetryExhaustedProblem,
  RetrySuccessHookProblem,
} from "./libs/errors";
export type { RetryNumericConstraint } from "./libs/errors";

/**
 * AWS Lambda 남은 실행 시간을 기준으로 재시도를 제어하는 타입입니다.
 */
export type { LambdaContext, TimeoutGuardOptions } from "./libs/LambdaTimeoutGuard";

/**
 * AWS Lambda 실행 시간과 남은 시간을 조회하는 타임아웃 가드 유틸리티입니다.
 */
export {
  getLambdaContext,
  getRemainingTimeInMillis,
  hasTimeForRetry,
  isLambdaEnvironment,
  LambdaTimeoutGuard,
  runWithLambdaContext,
  setLambdaContext,
} from "./libs/LambdaTimeoutGuard";

/**
 * 서킷 상태가 예상 범위를 벗어났을 때 발생하는 Problem 타입입니다.
 */
export { CircuitBreakerUnexpectedStateProblem } from "./libs/problems/CircuitBreakerProblems";

/**
 * `@Recover` 메서드에 저장되는 메타데이터 타입입니다.
 */
export type { RecoverMetadata } from "./libs/Recover";

/**
 * 재시도 실패 후 복구 메서드를 등록하고 조회하는 데코레이터와 유틸리티입니다.
 */
export { findRecoverMethod, getRecoverMethods, Recover } from "./libs/Recover";

/**
 * `@Retryable` 데코레이터 설정에 사용하는 옵션 타입입니다.
 */
export type {
  CircuitBreakerConfig,
  CircuitIdResolverContext,
  RetryableOptions,
  RetrySignalResolverContext,
} from "./libs/Retryable";

/**
 * 메서드에 선언형 재시도 정책을 적용하는 데코레이터입니다.
 */
export { Retryable } from "./libs/Retryable";

/**
 * 현재 재시도 횟수, 인자, 마지막 오류를 추적하는 런타임 컨텍스트입니다.
 */
export { RetryContext } from "./libs/RetryContext";

/**
 * 고수준 재시도 API가 공통으로 사용하는 저수준 재시도 루프 실행기입니다.
 */
export { executeRetryLoop } from "./libs/RetryEngine";
export type { RetryHooks } from "./libs/RetryEngine";

/**
 * 재시도 라이프사이클을 관찰하는 리스너 계약입니다.
 */
export type { RetryListener } from "./libs/RetryListener";

/**
 * 콜백 조합과 로그 출력을 위한 기본 리스너 구현체입니다.
 */
export { CompositeRetryListener, LoggingRetryListener } from "./libs/RetryListener";

/**
 * 공용 재시도 오케스트레이터 설정 타입입니다.
 */
export type { RetryOrchestratorOptions } from "./libs/RetryOrchestrator";

/**
 * 정책, 백오프, 리스너, 복구 로직을 묶어 실행하는 공용 오케스트레이터입니다.
 */
export { RetryOrchestrator } from "./libs/RetryOrchestrator";

/**
 * 재시도 여부를 판단하는 정책 계약과 옵션 타입입니다.
 */
export type { RetryPolicy, RetryPolicyOptions } from "./libs/RetryPolicy";

/**
 * 기본 재시도 정책 구현체와 기본 분류 상수입니다.
 */
export {
  DEFAULT_NO_RETRY_FOR,
  DEFAULT_RETRYABLE_CATEGORIES,
  DefaultRetryPolicy,
} from "./libs/RetryPolicy";

/**
 * 프로그래밍 방식 재시도 실행에 사용하는 콜백과 옵션 타입입니다.
 */
export type { RecoveryCallback, RetryCallback, RetryTemplateOptions } from "./libs/RetryTemplate";

/**
 * 콜백 기반으로 작업을 재시도하고 필요 시 복구까지 수행하는 템플릿입니다.
 */
export { RetryTemplate } from "./libs/RetryTemplate";
