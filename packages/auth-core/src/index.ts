/**
 * @packageDocumentation
 *
 * RBAC, API 키, 인증 가드, 권한 데코레이터를 제공하는 인증 코어 패키지입니다.
 */

/**
 * 안전한 API 키를 생성하는 유틸리티입니다.
 */
export { ApiKeyGenerator } from "./libs/apikey/ApiKeyGenerator";

/**
 * API 키 해시 생성과 검증을 담당합니다.
 */
export { ApiKeyHasher } from "./libs/apikey/ApiKeyHasher";

/**
 * API 키 생성, 검증, 폐기, 회전을 담당하는 관리자입니다.
 */
export { ApiKeyManager } from "./libs/apikey/ApiKeyManager";

/**
 * API 키 저장소 토큰과 추상 저장소 계약입니다.
 */
export { API_KEY_STORE_TOKEN, ApiKeyStore } from "./libs/apikey/ApiKeyStore";

/**
 * 인증 데코레이터와 가드가 사용하는 메타데이터 키입니다.
 */
export { API_KEY_REQUIRED_KEY, AUTH_PERMISSIONS_KEY, AUTH_PUBLIC_KEY } from "./libs/constants";

/**
 * 현재 API 키를 파라미터에 주입하는 데코레이터입니다.
 */
export { CurrentApiKey } from "./libs/decorators/CurrentApiKey";

/**
 * 현재 인증 주체를 파라미터에 주입하는 데코레이터입니다.
 */
export { CurrentPrincipal } from "./libs/decorators/CurrentPrincipal";

/**
 * 공개 엔드포인트를 선언하는 데코레이터입니다.
 */
export { Public } from "./libs/decorators/Public";

/**
 * API 키 인증이 필요한 엔드포인트를 선언하는 데코레이터입니다.
 */
export { RequireApiKey } from "./libs/decorators/RequireApiKey";

/**
 * 필요한 권한 목록을 선언하는 데코레이터입니다.
 */
export { RequirePermission } from "./libs/decorators/RequirePermission";

/**
 * 현재 인증 사용자를 파라미터에 주입하는 데코레이터입니다.
 */
export { User } from "./libs/decorators/User";

/**
 * API 키 기반 인증 가드입니다.
 */
export { ApiKeyGuard } from "./libs/guards/ApiKeyGuard";

/**
 * 사용자 인증을 검사하는 기본 인증 가드입니다.
 */
export { AUTH_PROVIDER_TOKEN, AuthGuard } from "./libs/guards/AuthGuard";

export { getHeaderValue } from "./libs/guards/headerUtils";

/**
 * 권한 기반 인가를 수행하는 가드입니다.
 */
export { PermissionGuard } from "./libs/guards/PermissionGuard";

/**
 * 사용자 인증과 API 키 인증을 함께 처리하는 통합 가드입니다.
 */
export { UnifiedAuthGuard } from "./libs/guards/UnifiedAuthGuard";

/**
 * 역할 레지스트리 구현이 따라야 하는 추상 계약입니다.
 */
export { AbstractRoleRegistry } from "./libs/interfaces/AbstractRoleRegistry";

/**
 * API 키 도메인 모델과 생성 관련 타입입니다.
 */
export type {
  ApiKey,
  ApiKeyRateLimit,
  CreateApiKeyOptions,
  CreateApiKeyResult,
} from "./libs/interfaces/ApiKey";

/**
 * API 키를 인증 주체로 해석하는 공급자 계약입니다.
 */
export type { ApiKeyProvider } from "./libs/interfaces/ApiKeyProvider";

/**
 * 사용자 인증 정보를 조회하는 공급자 계약입니다.
 */
export type { AuthProvider } from "./libs/interfaces/AuthProvider";

/**
 * 인증 가드가 확장하는 요청 타입입니다.
 */
export type { AuthRequest } from "./libs/interfaces/AuthRequest";

/**
 * 인증된 사용자 타입입니다.
 */
export type { AuthUser } from "./libs/interfaces/AuthUser";

/**
 * 라우트 가드 실행 컨텍스트 타입입니다.
 */
export type { RouteExecutionContext } from "./libs/interfaces/Guard";

/**
 * 사용자 주체와 API 키 주체 타입입니다.
 */
export type {
  ApiKeyPrincipal,
  Principal,
  PrincipalType,
  UserPrincipal,
} from "./libs/interfaces/Principal";

/**
 * 세션 조회와 관리에 사용하는 타입과 공급자 계약입니다.
 */
export type {
  Session,
  SessionListOptions,
  SessionListResult,
  SessionProvider,
} from "./libs/interfaces/SessionProvider";

/**
 * 사용자와 tenant 정보를 연결하는 매핑 공급자 계약입니다.
 */
export type { TenantMappingProvider } from "./libs/interfaces/TenantMapping";

/**
 * 인증 도메인에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  ApiKeyCreationFailedProblem,
  ApiKeyExpiredProblem,
  ApiKeyRevokedProblem,
  ForbiddenProblem,
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
  UnauthorizedProblem,
} from "./libs/problems/AuthProblems";

/**
 * 권한 문자열 파싱, 포맷팅, 검사 유틸리티와 타입입니다.
 */
export {
  formatPermission,
  getResourcePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  hasResourcePermission,
  type Permission,
  type PermissionAction,
  parsePermission,
} from "./libs/rbac/Permission";

/**
 * 역할 기반 접근 제어 엔진입니다.
 */
export { RbacEngine } from "./libs/rbac/RbacEngine";

/**
 * 역할 정의 타입과 역할 레지스트리 구현체입니다.
 */
export { RoleRegistry } from "./libs/rbac/Role";
export type { RoleDefinition } from "./libs/rbac/RoleDefinition";

/**
 * auth-core에서 재노출하는 추가 공개 타입입니다.
 */
export * from "./libs/types";
