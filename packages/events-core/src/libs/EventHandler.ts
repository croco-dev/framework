import type { DomainEvent } from './DomainEvent';
import { EventBusConfig } from './EventBusConfig';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

export type EventHandlerClass<T extends DomainEvent = DomainEvent> = new (...args: any) => EventHandler<T>;

export function RegisterEventHandler(eventClass: new (...args: any) => DomainEvent) {
  return <T extends EventHandlerClass>(f: T) => {
    EventBusConfig.getInstance().subscribe({
      eventName: eventClass.name,
      handlerClass: f,
    });
    return f;
  };
}
