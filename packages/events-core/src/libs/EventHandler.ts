import type { Constructor } from '@croco/framework-context';
import type { DomainEvent } from './DomainEvent';
import { EventBusConfig } from './EventBusConfig';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

type DomainEventClass<TArgs extends unknown[] = unknown[]> = (new (
  ...args: TArgs
) => DomainEvent) & {
  eventName?: string;
};

export type EventHandlerClass<T extends DomainEvent = DomainEvent> = Constructor<EventHandler<T>>;

export function RegisterEventHandler<TArgs extends unknown[]>(
  eventClass: DomainEventClass<TArgs>,
  options?: { eventName?: string }
) {
  return <T extends EventHandlerClass>(f: T): void => {
    EventBusConfig.getInstance().subscribe({
      eventName: options?.eventName ?? eventClass.eventName ?? eventClass.name,
      handlerClass: f,
    });
  };
}
