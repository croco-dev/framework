/**
 * @packageDocumentation
 *
 * 사용자 활동과 상태 변경을 추적하는 감사 로깅 코어 패키지입니다.
 */

import "reflect-metadata";

/**
 * 감사 대상 메서드 파라미터 메타데이터 키와 데코레이터입니다.
 */
export { AUDIT_PARAM_KEY, Auditable } from "./libs/Auditable";

/**
 * 감사 로그 쓰기 실패 시 재시도하는 에러 핸들러와 헬퍼입니다.
 */
export { AuditErrorHandler, fireAndForgetWithRetry } from "./libs/AuditErrorHandler";

/**
 * 감사 로그 무결성 체인 검증에 사용하는 타입들입니다.
 */
export type {
  AuditChainVerifier,
  AuditIntegrityConfig,
  AuditIntegrityMetadata,
  AuditIntegrityVerifier,
  AuditSequenceConfig,
  AuditSequenceGenerator,
  TamperProofAuditLog,
} from "./libs/AuditIntegrity";

/**
 * HTTP 요청 흐름을 감사 로그로 기록하는 인터셉터입니다.
 */
export { AuditInterceptor } from "./libs/AuditInterceptor";
export type { AuditInterceptorOptions } from "./libs/AuditInterceptor";

/**
 * 감사 로그 저장소 추상 계약입니다.
 */
export { AuditLogRepository } from "./libs/AuditLogRepository";

/**
 * 요청 컨텍스트의 impersonation 상태를 분류하고 활성 세션 스냅샷을 반환합니다.
 */
export { resolveImpersonationContext } from "./libs/impersonationState";
export type {
  ActiveImpersonationState,
  ImpersonationContextResolution,
} from "./libs/impersonationState";

/**
 * 감사 로그 저장소를 DI에 등록할 때 사용하는 토큰입니다.
 */
export { AUDIT_LOG_REPOSITORY_TOKEN } from "./libs/AuditLogRepositoryToken";

/**
 * 감사 메타데이터 저장 키입니다.
 */
export { AUDIT_METADATA_KEY } from "./libs/constants";

/**
 * 감사 인터셉터 실행 컨텍스트와 인터셉터 타입입니다.
 */
export type {
  AuditExecutionContext,
  CallHandler,
  Interceptor,
} from "./libs/interfaces/Interceptor";

/**
 * Auditable 데코레이터 오용 시 사용하는 Problem 타입입니다.
 */
export { AuditableDecoratorProblem } from "./libs/problems/AuditableDecoratorProblem";
export { AuditClientIpConfigurationProblem } from "./libs/problems/AuditClientIpConfigurationProblem";

/**
 * 감사 로그 엔트리, payload, 쿼리, 데코레이터 옵션 타입입니다.
 */
export type {
  AuditableOptions,
  AuditLogEntry,
  AuditParamMetadata,
  AuditPayload,
  AuditQuery,
} from "./libs/types";
