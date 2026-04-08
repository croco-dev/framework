/**
 * @packageDocumentation
 *
 * Audit Core 패키지는 애플리케이션에서 사용자 활동과 상태 변경을 추적하는 감사 로깅 기능을 제공합니다.
 *
 * @remarks
 * 이 패키지는 다음과 같은 기능을 포함합니다:
 * - {@link Auditable} 데코레이터: 메서드 실행을 자동으로 감사 로그에 기록
 * - {@link AuditInterceptor} 클래스: HTTP 요청에 대한 감사 로그 자동 기록
 * - {@link AuditLogRepository} 추상 클래스: 감사 로그 저장소 인터페이스
 *
 * @example
 * ```typescript
 * import { Auditable } from '@croco/audit-core';
 *
 * class UserService {
 *   @Auditable({
 *     action: 'user.update',
 *     resourceType: 'User',
 *     resourceIdParam: 'id',
 *     payloadParam: 'dto',
 *   })
 *   async updateUser(id: string, dto: UpdateUserDto) {
 *     // 사용자 업데이트 로직
 *   }
 * }
 * ```
 */

import 'reflect-metadata';

export { AUDIT_PARAM_KEY, Auditable } from './libs/Auditable';
export { AuditErrorHandler, fireAndForgetWithRetry } from './libs/AuditErrorHandler';
export type {
  AuditChainVerifier,
  AuditIntegrityConfig,
  AuditIntegrityMetadata,
  AuditIntegrityVerifier,
  AuditSequenceConfig,
  AuditSequenceGenerator,
  TamperProofAuditLog,
} from './libs/AuditIntegrity';
export { AuditInterceptor } from './libs/AuditInterceptor';
export { AuditLogRepository } from './libs/AuditLogRepository';
export { AUDIT_LOG_REPOSITORY_TOKEN } from './libs/AuditLogRepositoryToken';
export { AUDIT_METADATA_KEY } from './libs/constants';
export type { AuditExecutionContext, CallHandler, Interceptor } from './libs/interfaces/Interceptor';
export { AuditableDecoratorProblem } from './libs/problems/AuditableDecoratorProblem';
export type { AuditableOptions, AuditLogEntry, AuditParamMetadata, AuditPayload, AuditQuery } from './libs/types';
