/**
 * Clerk 인증 readiness diagnostics provider입니다.
 */
export {
  type ClerkAuthDiagnosticsConfig,
  type ClerkAuthDiagnosticsOptions,
  ClerkAuthDiagnosticsProvider,
  type ClerkAuthReadinessCheckContext,
  type ClerkAuthReadinessCheckResult,
} from "./libs/ClerkAuthDiagnosticsProvider";

/**
 * Clerk 인증 제공자 생성 옵션입니다.
 */
export type { ClerkAuthOptions } from "./libs/ClerkAuthProvider";

/**
 * Clerk Bearer 토큰을 검증해 Croco 사용자로 변환하는 인증 제공자입니다.
 */
export { ClerkAuthProvider } from "./libs/ClerkAuthProvider";

/**
 * Clerk 조직 관리에 필요한 공개 타입입니다.
 */
export type {
  ClerkOrganization,
  ClerkOrganizationInvitation,
  ClerkOrganizationMembership,
  CreateInvitationInput,
  CreateMembershipInput,
  CreateOrganizationInput,
  OrganizationListOptions,
  OrganizationListResult,
  UpdateOrganizationInput,
} from "./libs/ClerkOrganizationService";
/**
 * Clerk 조직, 멤버십, 초대를 관리하는 서비스입니다.
 */
export { ClerkOrganizationService } from "./libs/ClerkOrganizationService";

/**
 * Clerk 세션 조회와 세션 해제를 담당하는 구현체입니다.
 */
export { ClerkSessionProvider } from "./libs/ClerkSessionProvider";

/**
 * Clerk tenant 매핑에 필요한 공개 타입입니다.
 */
export type { ClerkTenantRequest, TenantMappingStore } from "./libs/ClerkTenantMapper";
/**
 * Clerk 조직 ID와 Croco tenant ID를 매핑하는 매퍼입니다.
 */
export { ClerkTenantMapper } from "./libs/ClerkTenantMapper";

/**
 * Clerk 사용자 관리에 필요한 공개 타입입니다.
 */
export type {
  ClerkUser,
  CreateClerkUserInput,
  UpdateClerkUserInput,
  UserListOptions,
  UserListResult,
} from "./libs/ClerkUserService";
/**
 * Clerk 사용자 조회, 생성, 수정, 밴 관리를 제공하는 서비스입니다.
 */
export { ClerkUserService } from "./libs/ClerkUserService";

/**
 * Clerk 웹훅 서명 검증과 이벤트 분기를 처리하는 핸들러입니다.
 */
export { ClerkWebhookHandler } from "./libs/ClerkWebhookHandler";
export type { ClerkTokenVerificationOperation } from "./libs/problems/ClerkProblems";
export {
  ClerkExternalServiceProblem,
  ClerkMalformedClaimProblem,
  ClerkPublicUserDataMissingProblem,
  ClerkTokenVerificationProblem,
  ClerkTokenVerificationUpstreamProblem,
  createClerkTokenVerificationProblem,
  DuplicateTenantMappingProblem,
  InvalidWebhookPayloadProblem,
  WebhookVerificationProblem,
} from "./libs/problems/ClerkProblems";

/**
 * Clerk 웹훅과 인증 요청에 필요한 공개 타입입니다.
 */
export type {
  AuthorizationHeaderCarrier,
  ClerkMembershipEvent,
  ClerkOrgEvent,
  ClerkUserEvent,
  WebhookEventHandler,
  WebhookEventType,
  WebhookHandlerOptions,
} from "./libs/types";
