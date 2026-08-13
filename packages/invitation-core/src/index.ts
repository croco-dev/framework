/**
 * @packageDocumentation
 *
 * 이메일 초대, 링크 초대, 도메인 자동 가입 정책을 제공하는 초대 코어 패키지입니다.
 */

/**
 * 이메일 도메인 자동 가입 정책을 관리하는 매니저입니다.
 */
export { DomainPolicyManager } from "./libs/DomainPolicyManager";

/**
 * 도메인 정책 저장소 추상 계약입니다.
 */
export { DomainPolicyStore } from "./libs/DomainPolicyStore";

/**
 * 도메인 정책 변경과 자동 가입 시 발행되는 이벤트입니다.
 */
export {
  DomainAutoJoinedEvent,
  DomainPolicyAddedEvent,
  DomainPolicyRemovedEvent,
} from "./libs/events/DomainPolicyEvents";

/**
 * 초대 생성, 수락, 거절, 취소 과정에서 발행되는 이벤트입니다.
 */
export {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationDeclinedEvent,
  InvitationRevokedEvent,
} from "./libs/events/InvitationEvents";

/**
 * 테스트와 로컬 개발용 인메모리 도메인 정책 저장소입니다.
 */
export { InMemoryDomainPolicyStore } from "./libs/InMemoryDomainPolicyStore";

/**
 * 테스트와 로컬 개발용 인메모리 초대 저장소입니다.
 */
export { InMemoryInvitationStore } from "./libs/InMemoryInvitationStore";

/**
 * 초대 생성과 수락에 사용하는 입력 타입입니다.
 */
export type {
  AcceptInvitationInput,
  CreateEmailInvitationInput,
  CreateLinkInvitationInput,
} from "./libs/InvitationManager";

/**
 * 초대 생성, 수락, 거절, 취소, 재전송을 담당하는 핵심 서비스입니다.
 */
export { InvitationManager } from "./libs/InvitationManager";

/**
 * 초대 저장소 추상 계약입니다.
 */
export { InvitationStore } from "./libs/InvitationStore";

/**
 * batch invite 크기 제한 위반 시 발생하는 Problem 타입입니다.
 */
export { BatchSizeExceededProblem } from "./libs/problems/BatchInviteProblems";

/**
 * 도메인 정책 검증 실패 시 사용하는 Problem 타입입니다.
 */
export {
  DomainAutoJoinRecoveryProblem,
  InvalidAutoJoinRoleProblem,
  PublicEmailDomainNotAllowedProblem,
} from "./libs/problems/DomainPolicyProblems";

/**
 * 초대 생성 입력, 상태, 토큰 검증 실패 시 사용하는 Problem 타입입니다.
 */
export {
  InvalidInvitationExpiryDurationProblem,
  InvitationAlreadyAcceptedProblem,
  InvitationCreationFailedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
  InvitationIdempotencyConflictProblem,
} from "./libs/problems/InvitationProblems";

/**
 * 초대 중복과 rate limit 초과 시 사용하는 Problem 타입입니다.
 */
export {
  DuplicateInvitationProblem,
  InvitationRateLimitExceededProblem,
} from "./libs/problems/RateLimitProblems";

/**
 * 초대 스팸 방지와 batch invite를 제공하는 상위 서비스입니다.
 */
export { RateLimitedInvitationService } from "./libs/RateLimitedInvitationService";

/**
 * 안전한 초대 토큰 생성과 해시에 사용하는 유틸리티입니다.
 */
export { generateToken, hashToken } from "./libs/token";

/**
 * 초대와 도메인 정책 도메인 타입입니다.
 */
export type {
  BatchInviteOptions,
  BatchInviteResult,
  DomainAutoJoinEventStatus,
  DomainAutoJoinIntent,
  DomainAutoJoinIntentCreation,
  DomainAutoJoinIntentInput,
  DomainPolicy,
  DomainPolicyCreateInput,
  EmailInvitationCreation,
  EmailInvitationCreationInput,
  Invitation,
  InvitationCreationPhaseStatus,
  InvitationCreateInput,
  InvitationStatus,
  InvitationType,
  RateLimitConfig,
} from "./libs/types";

/**
 * 자동 가입에서 제외할 공개 이메일 도메인 목록입니다.
 */
export { PUBLIC_EMAIL_DOMAINS } from "./libs/types";
