import { type Constructor, MetadataStorage } from '@croco/framework-context';
import type { DomainEvent } from './DomainEvent';
import type { EventSubscription } from './EventBus';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

type DomainEventClass<TArgs extends unknown[] = unknown[]> = (new (
  ...args: TArgs
) => DomainEvent) & {
  eventName?: string;
};

export type EventHandlerClass<T extends DomainEvent = DomainEvent> = Constructor<EventHandler<T>>;

const EVENT_HANDLER_SUBSCRIPTION_METADATA = Symbol('events-core:event-handler-subscription');

/**
 * 핸들러 클래스에 등록된 이벤트 구독 메타데이터를 조회합니다.
 */
export function getEventHandlerSubscriptions(handlerClass: EventHandlerClass): EventSubscription[] {
  return MetadataStorage.getAllForTarget<EventSubscription>(EVENT_HANDLER_SUBSCRIPTION_METADATA, handlerClass).map(
    ({ value }) => value
  );
}

/**
 * 이벤트 클래스와 핸들러 클래스를 연결하는 데코레이터입니다.
 */
export function RegisterEventHandler<TArgs extends unknown[]>(
  eventClass: DomainEventClass<TArgs>,
  options?: { eventName?: string }
) {
  return <T extends EventHandlerClass>(f: T): void => {
    MetadataStorage.define(EVENT_HANDLER_SUBSCRIPTION_METADATA, f, {
      eventName: options?.eventName ?? eventClass.eventName ?? eventClass.name,
      handlerClass: f,
    });
  };
}
