/**
 * 도메인 이벤트를 수집하고 발행할 수 있는 Aggregate Root 추상 클래스입니다.
 */
export { AggregateRoot } from "./libs/AggregateRoot";
/**
 * 도메인 이벤트에 첨부할 수 있는 메타데이터 타입입니다.
 */
export type { DomainEventMetadata, EventTraceContext } from "./libs/DomainEvent";

/**
 * 모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.
 */
export { DomainEvent } from "./libs/DomainEvent";

/**
 * 이벤트 필드 메타데이터 타입입니다.
 */
export type { EventFieldMeta } from "./libs/decorators/EventField";

/**
 * 이벤트 직렬화 대상 필드를 선언하고 조회하는 데코레이터/유틸리티입니다.
 */
export { EventField, getEventFields } from "./libs/decorators/EventField";

/**
 * 이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.
 */
export type { EventBus } from "./libs/EventBus";
/**
 * 이벤트 이름 패턴 매칭을 최적화하는 구독 인덱스입니다.
 */
export { EventSubscriptionIndex } from "./libs/EventBus";
/**
 * 전역 EventBus 설정과 핸들러 등록 초기화를 관리합니다.
 */
export { EventBusConfig } from "./libs/EventBusConfig";
export { EventBusStats } from "./libs/EventBusStats";
export { EventBusDiagnosticsProvider } from "./libs/diagnostics/EventBusDiagnosticsProvider";
/**
 * 이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.
 */
export type { EventHandler, EventHandlerClass } from "./libs/EventHandler";
/**
 * 이벤트 타입과 핸들러를 연결하는 클래스 데코레이터입니다.
 */
export { getEventHandlerSubscriptions, RegisterEventHandler } from "./libs/EventHandler";
/**
 * 구성된 EventBus를 통해 단건/다건 이벤트를 발행하는 헬퍼입니다.
 */
export { EventPublisher } from "./libs/EventPublisher";
/**
 * 이벤트 타입 레지스트리와 전역 레지스트리 및 등록 데코레이터입니다.
 */
export { EventRegistry, globalEventRegistry, RegisterEvent } from "./libs/EventRegistry";
/**
 * 이벤트 직렬화 계약 및 직렬화 결과 타입입니다.
 */
export type { EventSerializer, SerializedEvent } from "./libs/EventSerializer";
/**
 * 기본 이벤트 직렬화 구현체입니다.
 */
export { DefaultEventSerializer } from "./libs/EventSerializer";
/**
 * 이벤트 핸들러 탐색/해결 계약 타입입니다.
 */
export type { HandlerResolver } from "./libs/HandlerResolver";
/**
 * 기본 이벤트 핸들러 해결 구현체입니다.
 */
export { DefaultHandlerResolver } from "./libs/HandlerResolver";
/**
 * DLQ (Dead Letter Queue) 인터페이스와 타입들입니다.
 */
export type {
  DeadLetterItem,
  DeadLetterPolicy,
  DeadLetterQueue,
  RetryableEventHandler,
} from "./libs/interfaces/DeadLetterQueue";
export { DEFAULT_DEAD_LETTER_POLICY } from "./libs/interfaces/DeadLetterQueue";
/**
 * 이벤트 발행 인터페이스입니다.
 */
export type { EventPublishing } from "./libs/interfaces/EventPublishing";
/**
 * 이벤트 구독 인터페이스입니다.
 */
export type { EventSubscribing } from "./libs/interfaces/EventSubscribing";
/**
 * 이벤트 코어에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  DuplicateEventFieldProblem,
  DuplicateEventNameProblem,
  EventAfterCommitOutcomeRequiredProblem,
  EventAfterCommitRequiresActiveTransactionProblem,
  EventBusNotSetProblem,
  EventDefinitionProblem,
  EventDeserializationError,
  EventTransactionContextUnavailableProblem,
  UnknownEventTypeProblem,
} from "./libs/problems/EventsProblems";
export type { EventSubscription } from "./libs/types/EventSubscription";
