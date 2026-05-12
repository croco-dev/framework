/**
 * @packageDocumentation
 *
 * 구독 결제, 체크아웃, 통화 값 객체, 플랜 전환 계약을 제공하는 빌링 코어 패키지입니다.
 */

/**
 * 외부 결제 제공자 연동 계약과 체크아웃 관련 타입입니다.
 */
export type { BillingGateway, CheckoutResult, CreateCheckoutParams } from "./libs/BillingGateway";

/**
 * BillingService 생성에 필요한 의존성과 체크아웃 입력 타입입니다.
 */
export type {
  BillingServiceDependencies,
  CreateBillingCheckoutParams,
} from "./libs/BillingService";

/**
 * 테넌트 기준 구독 조회, 체크아웃 생성, 취소, 재개를 처리하는 핵심 서비스입니다.
 */
export { BillingService } from "./libs/BillingService";

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

/**
 * billing 도메인에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  InvalidMoneyAmountProblem,
  InvalidMoneyCurrencyProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
  SubscriptionNotFoundProblem,
  WebhookAlreadyProcessedProblem,
} from "./libs/problems/BillingProblems";

/**
 * billing account, invoice, order, plan, subscription 도메인 타입입니다.
 */
export type {
  BillingAccount,
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemType,
  InvoiceStatus,
  Order,
  Plan,
  PlanInterval,
  ProcessedWebhook,
  Subscription,
  SubscriptionStatus,
} from "./types";
