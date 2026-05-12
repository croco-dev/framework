import type { DomainEvent } from "../DomainEvent";

/**
 * 이벤트 발행 인터페이스입니다.
 * 이벤트 버스에서 이벤트를 발행하는 기능만 제공합니다.
 */
export interface EventPublishing<TEvent extends DomainEvent = DomainEvent> {
  publish(event: TEvent): Promise<void>;
}
