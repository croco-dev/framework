import { DomainEvent } from './DomainEvent';
import { EventHandlerClass } from './EventHandler';

export interface EventSubscription {
  eventName: string;
  handlerClass: EventHandlerClass;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}
