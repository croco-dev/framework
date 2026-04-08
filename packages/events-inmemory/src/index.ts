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

export type { BackpressureStrategy, EventPublishFailure, InMemoryEventBusOptions } from './libs/InmemoryEventBus';
/**
 * `@croco/events-core`의 EventBus 인터페이스를 인메모리로 구현한 EventBus입니다.
 */
export { EventPublishFailedError, InMemoryEventBus } from './libs/InmemoryEventBus';
export { BackpressureExceededProblem } from './libs/problems/EventsInmemoryProblems';
