/**
 * @croco/events-inmemory
 *
 * {@link https://github.com/croco-dev/croco-framework | GitHub Repository}
 *
 * ---
 *
 * ## In-Memory Event Bus Implementation
 *
 * `@croco/events-core`의 EventBus 인터페이스를 구현한 인메모리 이벤트 버스입니다.
 * TypeDI 컨테이너와 통합되어 핸들러 인스턴스를 자동으로 주입하며,
 * OpenTelemetry를 통한 분산 추적을 지원합니다.
 *
 * @example
 * ```typescript
 * import 'reflect-metadata';
 * import { EventBusConfig, RegisterEventHandler } from '@croco/events-core';
 * import { InMemoryEventBus } from '@croco/events-inmemory';
 *
 * const config = EventBusConfig.getInstance();
 * config.setEventBus(new InMemoryEventBus());
 * await config.start({ handlers: [MyEventHandler] });
 * ```
 *
 * @packageDocumentation
 */

/**
 * 인메모리 이벤트 버스의 동시성 제어 전략과 옵션 타입입니다.
 */
export type {
  BackpressureStrategy,
  EventPublishFailure,
  InMemoryEventBusOptions,
} from "./libs/InmemoryEventBus";
/** 인메모리 dead-letter 재생 결과와 실패 타입입니다. */
export type { DeadLetterReplayFailure, DeadLetterReplayResult } from "./libs/InmemoryEventBus";
/** 인메모리 dead-letter 항목 타입입니다. */
export type { InMemoryDeadLetterItem } from "./libs/InMemoryDeadLetterQueue";
/**
 * 하나 이상의 이벤트 핸들러 실행이 실패했을 때 발생하는 집계 에러입니다.
 */
/**
 * `@croco/events-core` EventBus를 인메모리로 구현한 기본 이벤트 버스입니다.
 */
export {
  EventPublishDroppedProblem,
  EventPublishFailedError,
  InMemoryEventBus,
} from "./libs/InmemoryEventBus";
export { InMemoryDeadLetterQueue } from "./libs/InMemoryDeadLetterQueue";

export {
  BackpressureExceededProblem,
  BackpressureTimeoutProblem,
  DeadLetterQueueNotConfiguredProblem,
  DeadLetterReplayHandlerUnavailableProblem,
  InvalidBackpressureStrategyProblem,
  InvalidDeadLetterHandlerIdentityProblem,
  InvalidDeadLetterPolicyProblem,
  InvalidDeadLetterQueueLimitProblem,
  InvalidDeadLetterRetryCountProblem,
  InvalidEventBusConfigurationProblem,
  UnsupportedDeadLetterValueProblem,
} from "./libs/problems/EventsInmemoryProblems";
export {
  MAX_EVENT_BUS_CONCURRENCY,
  MAX_EVENT_BUS_TIMEOUT_MS,
} from "./libs/problems/EventsInmemoryProblems";
export type { EventBusNumericOption } from "./libs/problems/EventsInmemoryProblems";
export type { DeadLetterPolicyOption } from "./libs/problems/EventsInmemoryProblems";
