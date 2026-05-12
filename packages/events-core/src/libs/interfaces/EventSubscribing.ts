import type { DomainEvent } from "../DomainEvent";
import type { EventSubscription } from "../types/EventSubscription";

/**
 * 이벤트 구독 인터페이스입니다.
 * 이벤트 버스에서 이벤트를 구독/해제하는 기능만 제공합니다.
 */
export interface EventSubscribing<TEvent extends DomainEvent = DomainEvent> {
  subscribe(subscription: EventSubscription<TEvent>): void;
  unsubscribe(subscription: EventSubscription<TEvent>): void;
  clear(): void;
}
