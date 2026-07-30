/**
 * @packageDocumentation
 *
 * 구독 결제, 체크아웃, 통화 값 객체, 플랜 전환 계약을 제공하는 빌링 코어 패키지입니다.
 */

/**
 * 외부 결제 제공자 연동 계약과 체크아웃 관련 타입입니다.
 */
export type {
  BillingGateway,
  BillingLifecycleGatewayOptions,
  CheckoutResult,
  CreateCheckoutParams,
} from "./libs/BillingGateway";

/** Explicit billing provider capability profiles and runtime composition. */
export {
  BillingProvider,
  defineBillingProvider,
  defineBillingProviderProfile,
} from "./libs/BillingProvider";
export { BILLING_PROVIDER_CAPABILITIES } from "./libs/BillingProviderCapabilities";
export type {
  BillingProviderCapability,
  BillingProviderCapabilityAvailability,
  BillingProviderCapabilityProfile,
  BillingProviderProfile,
} from "./libs/BillingProviderCapabilities";
export type { BillingProviderImplementations } from "./libs/BillingProvider";

/** Provider-neutral usage event ingestion and customer meter state contracts. */
export type {
  CustomerMeterState,
  CustomerMeterStateQuery,
  DuplicateUsageBillingEventReceipt,
  InsertedUsageBillingEventReceipt,
  UsageBillingBatchReceipt,
  UsageBillingDimensionValue,
  UsageBillingEvent,
  UsageBillingEventReceipt,
  UsageBillingGateway,
} from "./libs/UsageBillingGateway";

/**
 * BillingService 생성에 필요한 의존성과 체크아웃 입력 타입입니다.
 */
export type {
  BillingLifecycleEventPublisher,
  BillingServiceDependencies,
  CancelSubscriptionParams,
  CreateBillingCheckoutParams,
  ReconcileBillingLifecycleCommandsResult,
  ResumeSubscriptionParams,
} from "./libs/BillingService";

/**
 * 테넌트 기준 구독 조회, 체크아웃 생성, 취소, 재개를 처리하는 핵심 서비스입니다.
 */
export { BillingService, hashCheckoutValue, stableStringify } from "./libs/BillingService";

/**
 * billing account, subscription, order를 저장하는 영속 계약입니다.
 */
export { BillingStore } from "./libs/BillingStore";

/**
 * 결제 완료 시 발행되는 도메인 이벤트입니다.
 */
export { OrderPaidEvent } from "./libs/events/OrderPaidEvent";

/**
 * 플랜 변경 시 발행되는 도메인 이벤트입니다.
 */
export { PlanChangedEvent } from "./libs/events/PlanChangedEvent";

/**
 * 구독 활성화 시 발행되는 도메인 이벤트입니다.
 */
export { SubscriptionActivatedEvent } from "./libs/events/SubscriptionActivatedEvent";

/**
 * 구독 취소 시 발행되는 도메인 이벤트입니다.
 */
export { SubscriptionCanceledEvent } from "./libs/events/SubscriptionCanceledEvent";

/**
 * 구독 연체 상태 전환 시 발행되는 도메인 이벤트입니다.
 */
export { SubscriptionPastDueEvent } from "./libs/events/SubscriptionPastDueEvent";

/**
 * 구독 회수 또는 강제 종료 시 발행되는 도메인 이벤트입니다.
 */
export { SubscriptionRevokedEvent } from "./libs/events/SubscriptionRevokedEvent";

/**
 * 테스트와 로컬 개발에 사용할 수 있는 인메모리 billing 저장소입니다.
 */
export { InMemoryBillingStore } from "./libs/InMemoryBillingStore";

/**
 * 테스트와 로컬 개발에 사용할 수 있는 불변 플랜 버전 레지스트리입니다.
 */
export { InMemoryPlanRegistry } from "./libs/InMemoryPlanRegistry";

/**
 * 인보이스 생성 계약과 입력 타입입니다.
 */
export type { GenerateInvoiceParams, InvoiceGenerator } from "./libs/InvoiceGenerator";

/**
 * Money 값 객체에서 사용하는 반올림 모드입니다.
 */
export type { MoneyRoundingMode } from "./libs/Money";

/**
 * 통화 안전 계산을 위한 값 객체입니다.
 */
export { Money } from "./libs/Money";

/**
 * 사용 가능한 플랜 정의 조회 계약입니다.
 */
export type { PlanRegistry } from "./libs/PlanRegistry";

/**
 * 레거시 구독에 검증된 플랜 버전을 명시적으로 고정합니다.
 */
export { migrateSubscriptionPlanVersion } from "./libs/migrateSubscriptionPlanVersion";

/**
 * 직렬화 가능한 플랜 버전 참조를 생성합니다.
 */
export { planVersionRef } from "./libs/planVersionRef";

/**
 * 플랜 전환 미리보기와 적용 계약입니다.
 */
export type {
  PlanTransitionParams,
  PlanTransitionPreview,
  PlanTransitionService,
} from "./libs/PlanTransitionService";

/**
 * 일할 계산 결과와 계산기 계약입니다.
 */
export type {
  ProrationCalculation,
  ProrationCalculationParams,
  ProrationCalculator,
} from "./libs/ProrationCalculator";

/** Quantity policy and billable membership evidence produce the provider's desired licensed quantity. */
export { calculateDesiredQuantity } from "./libs/SubscriptionQuantity";
/** Creates a deterministic reconciliation identity from tenant, subscription, plan, quantity, and source version. */
export { createSubscriptionQuantityReconciliationId } from "./libs/SubscriptionQuantity";
/** In-memory reconciliation intent store for tests and local composition. */
export { InMemorySubscriptionQuantityReconciliationStore } from "./libs/SubscriptionQuantity";
/** Signals that the provider quantity differs from the desired application-owned quantity. */
export { SubscriptionQuantityDriftDetectedEvent } from "./libs/SubscriptionQuantity";
/** Signals that a previously observed provider quantity drift has recovered. */
export { SubscriptionQuantityDriftRecoveredEvent } from "./libs/SubscriptionQuantity";
/** Persists and converges licensed-quantity reconciliation intents against a provider gateway. */
export { SubscriptionQuantityReconciler } from "./libs/SubscriptionQuantity";
/** Carries stable Problem evidence for a failed licensed-quantity reconciliation. */
export { SubscriptionQuantityReconciliationFailedEvent } from "./libs/SubscriptionQuantity";
/** Carries the quantity that was successfully reconciled with the provider. */
export { SubscriptionQuantityReconciliationSucceededEvent } from "./libs/SubscriptionQuantity";
export type {
  CreateSubscriptionQuantityIntent,
  LicensedQuantityGateway,
  LicensedQuantityObservation,
  ReconcileSubscriptionQuantitiesResult,
  ReconcileSubscriptionQuantityInput,
  SetLicensedQuantityInput,
  SetLicensedQuantityResult,
  SubscriptionQuantityDiagnostics,
  SubscriptionQuantityFailureEvidence,
  SubscriptionQuantityReconcilerDependencies,
  SubscriptionQuantityReconciliationEventPublisher,
  SubscriptionQuantityReconciliationState,
  SubscriptionQuantityReconciliationStore,
  SubscriptionQuantityRepairSource,
  SubscriptionQuantitySnapshot,
  SubscriptionQuantitySource,
  SubscriptionQuantitySourceInput,
  SubscriptionQuantitySourceSnapshot,
} from "./libs/SubscriptionQuantity";

/**
 * billing 도메인에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  BillingCheckoutInProgressProblem,
  BillingLifecycleCommandConflictProblem,
  BillingLifecycleCommandInProgressProblem,
  BillingLifecycleCommandNotFoundProblem,
  InvalidBillingLifecycleIdempotencyKeyProblem,
  InvalidMoneyAmountProblem,
  InvalidMoneyCurrencyProblem,
  InvalidPlanVersionDefinitionProblem,
  InvalidPlanVersionRefProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
  PlanVersionAlreadyPublishedProblem,
  PlanVersionConflictProblem,
  ProviderCapabilityUnavailableProblem,
  InvalidSubscriptionQuantityProblem,
  SubscriptionQuantityReconciliationConflictProblem,
  SubscriptionQuantityReconciliationFailedProblem,
  SubscriptionQuantityProviderMismatchProblem,
  SubscriptionQuantityProviderSourceAheadProblem,
  SubscriptionQuantitySourceMismatchProblem,
  SubscriptionPlanVersionMismatchProblem,
  SubscriptionNotFoundProblem,
  UnknownPlanVersionProblem,
  UnknownProviderPlanMappingProblem,
  WebhookAlreadyProcessedProblem,
} from "./libs/problems/BillingProblems";

/**
 * billing account, invoice, order, plan, subscription 도메인 타입입니다.
 */
export type {
  BillingAccount,
  BillingLifecycleCommand,
  BillingLifecycleCommandFailure,
  BillingLifecycleCommandKind,
  BillingLifecycleCommandState,
  BillingLifecycleLocalResult,
  BillingLifecycleSubscriptionResolution,
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemType,
  InvoiceStatus,
  LegacySubscription,
  MembershipRole,
  Order,
  Plan,
  PlanInterval,
  PlanRatingDefinition,
  SubscriptionQuantityPolicy,
  PlanVersionDefinition,
  PlanVersionRef,
  ProcessedWebhook,
  ProviderPlanBinding,
  ProviderPlanLookup,
  Subscription,
  SubscriptionStatus,
} from "./types";
