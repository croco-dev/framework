import type { DomainEvent } from './DomainEvent';
import { getEventFields } from './decorators/EventField';
import { globalEventRegistry } from './EventRegistry';

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
  constructor(private readonly registry = globalEventRegistry) {}

  serialize<T extends DomainEvent>(event: T): SerializedEvent {
    return {
      eventType: event.eventName,
      eventId: this.generateEventId(),
      occurredAt: event.timestamp.toISOString(),
      aggregateId: this.extractAggregateId(event),
      payload: this.extractPayload(event),
    };
  }

  deserialize<T extends DomainEvent>(data: SerializedEvent): T {
    const EventClass = this.registry.get(data.eventType);

    if (!EventClass) {
      throw new Error(`Unknown event type: ${data.eventType}`);
    }

    return this.reconstructEvent(EventClass, data) as T;
  }

  private generateEventId(): string {
    return crypto.randomUUID();
  }

  private extractAggregateId(event: DomainEvent): string | undefined {
    const aggregateIdKey = 'aggregateId';
    if (aggregateIdKey in event) {
      return (event as unknown as Record<string, unknown>)[aggregateIdKey] as string;
    }
    return undefined;
  }

  private extractPayload(event: DomainEvent): Record<string, unknown> {
    const fields = getEventFields(event.constructor as new (...args: unknown[]) => unknown);
    const obj = event as unknown as Record<string, unknown>;

    if (fields) {
      const result: Record<string, unknown> = {};
      for (const { propertyKey, serializedKey } of fields) {
        result[serializedKey] = obj[propertyKey];
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    const reservedKeys = new Set(['eventName', 'timestamp', 'metadata']);
    for (const key in event) {
      if (!reservedKeys.has(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  private reconstructEvent<T extends DomainEvent>(EventClass: new (...args: unknown[]) => T, data: SerializedEvent): T {
    const eventClassWithFromPayload = EventClass as EventClassWithOptionalFromPayload<T>;
    if (eventClassWithFromPayload.fromPayload) {
      return eventClassWithFromPayload.fromPayload(data.payload) as T;
    }

    const fields = getEventFields(EventClass as new (...args: unknown[]) => unknown);

    if (fields) {
      const instance = new EventClass() as T;
      const obj = instance as unknown as Record<string, unknown>;
      for (const { propertyKey, serializedKey } of fields) {
        obj[propertyKey] = data.payload[serializedKey];
      }
      return instance;
    }

    const constructorParameterNames = this.getConstructorParameterNames(EventClass);
    if (constructorParameterNames.length === 0) {
      return new EventClass(...Object.values(data.payload));
    }

    const args = constructorParameterNames.map((parameterName) => data.payload[parameterName]);
    return new EventClass(...args);
  }

  private getConstructorParameterNames<T extends DomainEvent>(EventClass: new (...args: unknown[]) => T): string[] {
    const constructorSource = EventClass.toString();
    const constructorMatch = constructorSource.match(/constructor\s*\(([^)]*)\)/);
    if (!constructorMatch) {
      return [];
    }

    return constructorMatch[1]
      .split(',')
      .map((parameter) => parameter.trim())
      .filter(Boolean)
      .map((parameter) =>
        parameter
          .replace(/=.*$/, '')
          .replace(/^\.\.\./, '')
          .trim()
      );
  }
}
