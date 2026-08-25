/**
 * @packageDocumentation
 *
 * 플랜 entitlement와 quota 강제를 제공하는 entitlements 코어 패키지입니다.
 */

/**
 * 엔드포인트에 필요한 entitlement를 선언하는 데코레이터입니다.
 */
export { RequireEntitlement } from "./libs/decorators/RequireEntitlement";

/**
 * route/service 경계에서 공유하는 entitlement requirement metadata contract입니다.
 */
export {
  appendEntitlementRequirement,
  defineEntitlementRequirement,
  ENTITLEMENT_REQUIRED_KEY,
  ENTITLEMENT_REQUIREMENTS_KEY,
  getEntitlementRequirements,
} from "./libs/EntitlementRequirement";
export type {
  EntitlementRequirement,
  EntitlementRequirementInput,
  EntitlementRequirementMetadata,
  EntitlementResourceRequirement,
} from "./libs/EntitlementRequirement";

/**
 * provider와 registry 경계에서 entitlement rule set의 공통 semantic invariant를 검증합니다.
 */
export { assertEntitlementRules } from "./libs/EntitlementRuleValidation";

/**
 * 타입 안전하고 버전 고정된 entitlement 정의를 만드는 공개 계약입니다.
 */
export {
  defineFeature,
  definePlanEntitlements,
  assertPlanVersionMatches,
  featureKey,
  getLegacyPlanId,
  legacyPlanVersionRef,
  meterKey,
  migrateLegacyPlanEntitlements,
} from "./libs/EntitlementDefinition";
export type {
  BillingRequiredMeterRef,
  EntitlementDefinition,
  FeatureRef,
  FeatureReference,
  MeterReference,
  PlanEntitlementDefinition,
} from "./libs/EntitlementDefinition";

/**
 * 라우트 실행 전에 entitlement를 검사하는 가드입니다.
 */
export { EntitlementGuard } from "./libs/EntitlementGuard";
export type {
  EntitlementGuardInput,
  EntitlementGuardResource,
  EntitlementGuardRoute,
  EntitlementGuardSubject,
  RouteExecutionContext,
} from "./libs/EntitlementGuard";

/**
 * 플랜 규칙과 quota를 조합해 entitlement 결과를 계산하는 핵심 서비스입니다.
 */
export { EntitlementManager } from "./libs/EntitlementManager";
export type { EntitlementManagerOptions } from "./libs/EntitlementManager";

/**
 * entitlement 거부, quota 초과, overage 허용 시 발행되는 이벤트입니다.
 */
export {
  EntitlementDeniedEvent,
  EntitlementOverageAllowedEvent,
  EntitlementQuotaExceededEvent,
} from "./libs/events";

/**
 * 테스트와 로컬 개발용 인메모리 플랜 entitlement 레지스트리입니다.
 */
export { InMemoryPlanEntitlementRegistry } from "./libs/InMemoryPlanEntitlementRegistry";

/**
 * 구독, quota, meter, 이벤트 발행 확장 포인트에 사용하는 추상 계약입니다.
 */
export * from "./libs/interfaces";

/**
 * entitlement 검사 실패 시 사용하는 Problem 타입입니다.
 */
export {
  EntitlementDefinitionProblem,
  EntitlementDeniedProblem,
  EntitlementInactiveSubscriptionProblem,
  EntitlementMissingPlanProblem,
  EntitlementNotFoundProblem,
  EntitlementPlanVersionAlreadyRegisteredProblem,
  EntitlementPlanVersionMismatchProblem,
  EntitlementPlanVersionNotFoundProblem,
  EntitlementProviderUnavailableProblem,
  EntitlementQuotaExceededProblem,
  EntitlementRequirementProblem,
} from "./libs/problems/EntitlementProblems";

/**
 * 단일 플랜을 고정으로 반환하는 구독 제공자 구현체입니다.
 */
export { StaticSubscriptionProvider } from "./libs/StaticSubscriptionProvider";

/**
 * entitlement 규칙, 결과, quota 상태를 표현하는 타입들입니다.
 */
export * from "./libs/types";
