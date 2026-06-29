/**
 * @packageDocumentation
 *
 * 멀티테넌시 컨텍스트, tenant 식별, 접근 가드, 격리 전략을 제공하는 테넌트 코어 패키지입니다.
 */

/**
 * 테넌트 접근 가드 인터페이스입니다.
 */
export type { TenantGuard } from "./libs/guards/TenantGuard";

/**
 * 활성 상태 테넌트만 허용하는 기본 가드입니다.
 */
export { ActiveTenantGuard } from "./libs/guards/TenantGuard";

/**
 * TenantManager 중복 등록 시 사용하는 Problem 타입입니다.
 */
export { DuplicateTenantManagerRegistrationProblem } from "./libs/problems/DuplicateTenantManagerRegistrationProblem";

/**
 * Tenant isolation enforcement failures and stable diagnostic codes.
 */
export {
  TENANT_ISOLATION_DIAGNOSTIC_CODES,
  TenantAdminBypassReasonRequiredProblem,
  TenantCrossTenantLeakProblem,
  TenantDefaultFallbackProblem,
  TenantIsolationContextMissingProblem,
  TenantUnsafeQueryProblem,
} from "./libs/problems/TenantIsolationProblems";
export type { TenantIsolationDiagnosticCode } from "./libs/problems/TenantIsolationProblems";

/**
 * 등록되지 않은 TenantManager 조회 시 사용하는 Problem 타입입니다.
 */
export { TenantManagerNotRegisteredProblem } from "./libs/problems/TenantManagerNotRegisteredProblem";

/**
 * tenant 조회 실패 시 사용하는 Problem 타입입니다.
 */
export { TenantNotFoundProblem } from "./libs/problems/TenantNotFoundProblem";

/**
 * tenant 컨텍스트가 없을 때 사용하는 Problem 타입입니다.
 */
export { TenantRequiredProblem } from "./libs/problems/TenantRequiredProblem";

/**
 * HTTP 헤더에서 tenantId를 해석하는 resolver입니다.
 */
export { HeaderTenantResolver } from "./libs/resolvers/HeaderTenantResolver";

/**
 * JWT claim에서 tenantId를 해석하는 resolver입니다.
 */
export { JwtTenantResolver } from "./libs/resolvers/JwtTenantResolver";

/**
 * 서브도메인에서 tenantId를 해석하는 resolver입니다.
 */
export { SubdomainTenantResolver } from "./libs/resolvers/SubdomainTenantResolver";

/**
 * 데이터 격리 전략 설정 타입입니다.
 */
export type {
  TenantIsolationConfig,
  TenantIsolationFilter,
  TenantIsolationStrategy,
  TenantIsolationType,
} from "./libs/TenantIsolationStrategy";

/**
 * Tenant model manifest, compatibility, playbook, and migration helpers.
 */
export {
  DEFAULT_TENANT_MODEL,
  TENANT_MODEL_DEFINITIONS,
  TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
  TENANT_MODEL_NAMES,
  createTenantMigrationPlan,
  createTenantModelManifest,
  createTenantModelManifestSchema,
  getTenantModelDefinition,
  isTenantModelName,
  renderTenantMigrationPlan,
  renderTenantModelPlaybook,
  validateTenantModelCompatibility,
} from "./libs/TenantModelManifest";
export type {
  TenantMigrationPlan,
  TenantModelCapabilityName,
  TenantModelCompatibilityDiagnostic,
  TenantModelCompatibilityInput,
  TenantModelCompatibilityResult,
  TenantModelDefinition,
  TenantModelDiagnosticCode,
  TenantModelManifest,
  TenantModelManifestSchema,
  TenantModelName,
  TenantModelRiskLevel,
  TenantModelRuntimeTarget,
} from "./tenant-model";

/**
 * Tenant-scoped operation, repository/query boundary, RLS evidence, and leak fixture helpers.
 */
export {
  createCrossTenantLeakFixture,
  createTenantIsolationEnforcer,
  createTenantRepositoryBoundary,
  markTenantScopedOperation,
  TenantIsolationEnforcer,
} from "./libs/TenantIsolationEnforcer";
export type {
  CrossTenantLeakFixture,
  CrossTenantLeakFixtureOptions,
  CrossTenantLeakFixtureRecord,
  TenantBypassReason,
  TenantContextProvider,
  TenantContextRequirement,
  TenantIsolationAuditEvent,
  TenantIsolationAuditSink,
  TenantIsolationEnforcerOptions,
  TenantIsolationEvidence,
  TenantOperationIsolation,
  TenantOperationKind,
  TenantQueryBoundary,
  TenantQueryPredicate,
  TenantRepositoryBoundary,
  TenantRlsEvidence,
  TenantScopedOperation,
  TenantScopedOperationMarker,
} from "./libs/TenantIsolationEnforcer";

/**
 * AsyncLocalStorage 기반 tenant 컨텍스트 관리자입니다.
 */
export { TenantManager } from "./libs/TenantManager";

/**
 * 여러 TenantManager 인스턴스를 등록하고 조회하는 레지스트리입니다.
 */
export { TenantManagerRegistry } from "./libs/TenantManagerRegistry";

/**
 * tenant 미들웨어 계약과 결과 타입입니다.
 */
export type {
  TenantMiddleware,
  TenantMiddlewareContext,
  TenantMiddlewareResult,
} from "./libs/TenantMiddleware";

/**
 * 요청에서 tenantId를 추출하는 resolver 계약입니다.
 */
export type { TenantResolver } from "./libs/TenantResolver";

/**
 * tenant 엔티티와 저장소 계약 타입입니다.
 */
export type {
  Tenant,
  TenantFilter,
  TenantSettings,
  TenantStatus,
  TenantStore,
} from "./libs/TenantStore";

/**
 * tenant 컨텍스트와 해석 결과 타입입니다.
 */
export type {
  TenantContext,
  TenantIdentificationMethod,
  TenantResolutionResult,
} from "./libs/types";
