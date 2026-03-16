import type { EventSubscription } from '../EventBus';

/**
 * 이벤트 구독 인터페이스입니다.
 * 이벤트 버스에서 이벤트를 구독/해제하는 기능만 제공합니다.
 */
export interface EventSubscribing {
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}
