import type { DomainEvent } from "./DomainEvent";
import { getEventFields } from "./decorators/EventField";
import { EventRegistry } from "./EventRegistry";
import {
  DuplicateEventFieldProblem,
  EventDeserializationError,
  UnknownEventTypeProblem,
} from "./problems/EventsProblems";

type EventFromPayload = (payload: Record<string, unknown>) => DomainEvent;

type EventClassWithOptionalFromPayload<T extends DomainEvent = DomainEvent> = (new (
  ...args: unknown[]
) => T) & {
  fromPayload?: EventFromPayload;
};

/**
 * 직렬화된 이벤트 데이터 구조
 */
export interface SerializedEvent {
  eventType: string;
  eventId: string;
  occurredAt: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
}

/**
 * 이벤트 직렬화 인터페이스
 */
export interface EventSerializer {
  serialize<T extends DomainEvent>(event: T): SerializedEvent;
  deserialize<T extends DomainEvent>(data: SerializedEvent): T;
}

/**
 * 기본 이벤트 직렬화 구현체
 */
export class DefaultEventSerializer implements EventSerializer {
  constructor(private readonly registry = EventRegistry.fromMetadata()) {}

  serialize<T extends DomainEvent>(event: T): SerializedEvent {
    return {
      eventType: event.eventName,
      eventId: event.eventId,
      occurredAt: event.timestamp.toISOString(),
      aggregateId: this.extractAggregateId(event),
      payload: this.extractPayload(event),
    };
  }

  deserialize<T extends DomainEvent>(data: SerializedEvent): T {
    const EventClass = this.registry.get(data.eventType);

    if (!EventClass) {
      throw new UnknownEventTypeProblem(data.eventType);
    }

    return this.reconstructEvent(EventClass, data) as T;
  }

  private extractAggregateId(event: DomainEvent): string | undefined {
    const aggregateIdKey = "aggregateId";
    if (aggregateIdKey in event) {
      return (event as unknown as Record<string, unknown>)[aggregateIdKey] as string;
    }
    return undefined;
  }

  private extractPayload(event: DomainEvent): Record<string, unknown> {
    const fields = getEventFields(event.constructor as new (...args: unknown[]) => unknown);
    const obj = event as unknown as Record<string, unknown>;

    if (fields) {
      this.assertNoDuplicateSerializedKeys(event.constructor.name, fields);
      const result: Record<string, unknown> = {};
      for (const { propertyKey, serializedKey } of fields) {
        result[serializedKey] = obj[propertyKey];
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    const reservedKeys = new Set(["eventId", "eventName", "timestamp", "metadata"]);
    for (const key in event) {
      if (!reservedKeys.has(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  private reconstructEvent<T extends DomainEvent>(
    EventClass: new (...args: unknown[]) => T,
    data: SerializedEvent,
  ): T {
    const eventClassWithFromPayload = EventClass as EventClassWithOptionalFromPayload<T>;
    if (eventClassWithFromPayload.fromPayload) {
      return eventClassWithFromPayload.fromPayload(data.payload) as T;
    }

    const fields = getEventFields(EventClass as new (...args: unknown[]) => unknown);

    if (fields && fields.length > 0) {
      this.assertNoDuplicateSerializedKeys(EventClass.name, fields);
      const instance = this.createInstance(EventClass, data);
      const obj = instance as unknown as Record<string, unknown>;
      for (const { propertyKey, serializedKey } of fields) {
        obj[propertyKey] = data.payload[serializedKey];
      }
      return instance;
    }

    throw new EventDeserializationError(
      EventClass.name,
      "EventSerializer requires @EventField decorator or static fromPayload() method for deserialization. " +
        "Constructor parameter name inference via toString() has been removed for minification safety.",
    );
  }

  private createInstance<T extends DomainEvent>(
    EventClass: new (...args: unknown[]) => T,
    _data: SerializedEvent,
  ): T {
    try {
      return new EventClass();
    } catch (error: unknown) {
      throw new EventDeserializationError(
        EventClass.name,
        "Events with required constructor arguments must provide a static fromPayload() method for deserialization.",
        { cause: error instanceof Error ? error : new Error(String(error)) },
      );
    }
  }

  private assertNoDuplicateSerializedKeys(
    eventClassName: string,
    fields: { serializedKey: string }[],
  ): void {
    const seenKeys = new Set<string>();

    for (const field of fields) {
      if (seenKeys.has(field.serializedKey)) {
        throw new DuplicateEventFieldProblem(eventClassName, field.serializedKey);
      }

      seenKeys.add(field.serializedKey);
    }
  }
}
