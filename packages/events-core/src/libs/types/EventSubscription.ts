import type { Constructor } from "@croco/framework-context";
import type { DomainEvent } from "../DomainEvent";

interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

type EventHandlerClass<T extends DomainEvent = DomainEvent> = Constructor<EventHandler<T>>;

export interface EventSubscription<TEvent extends DomainEvent = DomainEvent> {
  eventName: EventNamePattern;
  handlerClass: EventHandlerClass<TEvent>;
  /** Explicit identity that remains stable across builds. Required by DLQ-enabled buses. */
  handlerId?: string;
  handler?: EventHandler<TEvent>;
}

export type EventNamePattern = string;
