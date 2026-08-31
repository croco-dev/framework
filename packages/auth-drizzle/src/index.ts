/**
 * Drizzle 기반 API 키 저장소 구현체입니다.
 */
export { DrizzleApiKeyStore } from "./libs/DrizzleApiKeyStore.js";
/**
 * 사용자 역할 할당과 조회를 담당하는 구현체입니다.
 */
export { DrizzleRoleRegistry } from "./libs/DrizzleRoleRegistry.js";
/**
 * Drizzle 기반 세션 조회, 회수 구현체입니다.
 */
export { DrizzleSessionProvider } from "./libs/DrizzleSessionProvider.js";
/**
 * 외부 조직 ID와 테넌트 ID를 매핑하는 구현체입니다.
 */
export { DrizzleTenantMappingProvider } from "./libs/DrizzleTenantMappingProvider.js";
/**
 * 외부 조직의 충돌하는 tenant 재매핑을 나타내는 Problem입니다.
 */
export {
  DuplicateTenantMappingProblem,
  TenantMappingConflictResolutionProblem,
} from "./libs/problems/DrizzleTenantMappingProblems.js";
/**
 * 인증 저장소용 Drizzle 스키마입니다.
 */
export { apiKeyRotations, apiKeys, sessions, tenantMappings, userRoles } from "./schema/index.js";

/**
 * API 키 회전 의도 테이블 마이그레이션입니다.
 */
export { addApiKeyRotations, removeApiKeyRotations } from "./migrations/addApiKeyRotations.js";
export type { ApiKeyRotationMigrationClient } from "./migrations/addApiKeyRotations.js";
