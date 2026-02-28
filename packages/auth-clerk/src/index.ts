/**
 * Clerk 기반 인증 제공자 구성 옵션 타입입니다.
 */
export type { ClerkAuthOptions } from './libs/ClerkAuthProvider';

/**
 * Clerk 토큰을 검증해 auth-core 사용자 정보로 변환하는 인증 제공자입니다.
 */
export { ClerkAuthProvider } from './libs/ClerkAuthProvider';

/**
 * Clerk 조직과 내부 tenant를 연결하는 저장소 계약입니다.
 */
export type { TenantMappingStore } from './libs/ClerkTenantMapper';

/**
 * Clerk 조직 정보를 내부 tenant 매핑으로 변환하는 매퍼입니다.
 */
export { ClerkTenantMapper } from './libs/ClerkTenantMapper';

/**
 * Clerk 웹훅 이벤트를 검증하고 라우팅하는 핸들러입니다.
 */
export { ClerkWebhookHandler } from './libs/ClerkWebhookHandler';

/**
 * Clerk 웹훅 서명 검증 실패 시 발생하는 Problem 하위 타입입니다.
 */
export { WebhookVerificationProblem } from './libs/problems/ClerkProblems';

/**
 * Clerk 웹훅 페이로드와 이벤트 핸들러 선언에 사용하는 공개 타입들입니다.
 */
export type {
  ClerkMembershipEvent,
  ClerkOrgEvent,
  ClerkUserEvent,
  WebhookEventHandler,
  WebhookHandlerOptions,
} from './libs/types';
