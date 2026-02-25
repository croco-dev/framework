import { beforeEach, describe, expect, it } from 'vitest';
import { DomainEvent } from '../libs/DomainEvent';
import { EventField } from '../libs/decorators/EventField';
import { EventRegistry, globalEventRegistry, RegisterEvent } from '../libs/EventRegistry';
import { DefaultEventSerializer, EventDeserializationError, type SerializedEvent } from '../libs/EventSerializer';

class TestEvent extends DomainEvent {
  static eventName = 'TestEvent';

  @EventField()
  public readonly value: string;

  @EventField()
  public readonly count: number;

  constructor(value: string, count: number) {
    super();
    this.value = value;
    this.count = count;
  }
}

class TestEventWithAggregate extends DomainEvent {
  static eventName = 'TestEventWithAggregate';

  @EventField()
  public readonly value: string;

  @EventField()
  public readonly aggregateId: string;

  constructor(value: string, aggregateId: string) {
    super();
    this.value = value;
    this.aggregateId = aggregateId;
  }
}

class ThreeFieldEvent extends DomainEvent {
  static eventName = 'ThreeFieldEvent';
  constructor(
    public readonly a: string,
    public readonly b: number,
    public readonly c: boolean
  ) {
    super();
  }
}

class RegisteredEvent extends DomainEvent {
  static eventName = 'RegisteredEvent';

  @EventField()
  public readonly data: string;

  constructor(data: string) {
    super();
    this.data = data;
  }
}

describe('DefaultEventSerializer', () => {
  let registry: EventRegistry;
  let serializer: DefaultEventSerializer;

  beforeEach(() => {
    registry = new EventRegistry();
    serializer = new DefaultEventSerializer(registry);
  });

  describe('serialize', () => {
    it('should serialize event with all required fields', () => {
      const event = new TestEvent('hello', 42);
      const serialized = serializer.serialize(event);

      expect(serialized).toMatchObject({
        eventType: 'TestEvent',
        occurredAt: expect.any(String),
        payload: {
          value: 'hello',
          count: 42,
        },
      });

      expect(serialized.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(new Date(serialized.occurredAt)).toBeInstanceOf(Date);
    });

    it('should extract aggregateId if present', () => {
      const event = new TestEventWithAggregate('test', 'agg-123');
      const serialized = serializer.serialize(event);

      expect(serialized.aggregateId).toBe('agg-123');
      expect(serialized.payload).toEqual({
        value: 'test',
        aggregateId: 'agg-123',
      });
    });

    it('should not include eventName in payload', () => {
      const event = new TestEvent('test', 1);
      const serialized = serializer.serialize(event);

      expect(serialized.payload).not.toHaveProperty('eventName');
    });

    it('should not include timestamp in payload', () => {
      const event = new TestEvent('test', 1);
      const serialized = serializer.serialize(event);

      expect(serialized.payload).not.toHaveProperty('timestamp');
    });

    it('should generate unique eventIds', () => {
      const event1 = new TestEvent('a', 1);
      const event2 = new TestEvent('b', 2);

      const serialized1 = serializer.serialize(event1);
      const serialized2 = serializer.serialize(event2);

      expect(serialized1.eventId).not.toBe(serialized2.eventId);
    });
  });

  describe('deserialize', () => {
    beforeEach(() => {
      registry.register(TestEvent);
      registry.register(TestEventWithAggregate);
    });

    it('should deserialize event successfully', () => {
      const data: SerializedEvent = {
        eventType: 'TestEvent',
        eventId: 'evt_123_abc',
        occurredAt: new Date().toISOString(),
        payload: {
          value: 'world',
          count: 100,
        },
      };

      const event = serializer.deserialize<TestEvent>(data);

      expect(event).toBeInstanceOf(TestEvent);
      expect(event.value).toBe('world');
      expect(event.count).toBe(100);
      expect(event.eventName).toBe('TestEvent');
    });

    it('should deserialize event with aggregateId', () => {
      const data: SerializedEvent = {
        eventType: 'TestEventWithAggregate',
        eventId: 'evt_456_def',
        occurredAt: new Date().toISOString(),
        aggregateId: 'agg-789',
        payload: {
          value: 'test',
          aggregateId: 'agg-789',
        },
      };

      const event = serializer.deserialize<TestEventWithAggregate>(data);

      expect(event.aggregateId).toBe('agg-789');
    });

    it('should throw error for unknown event type', () => {
      const data: SerializedEvent = {
        eventType: 'UnknownEvent',
        eventId: 'evt_000_xyz',
        occurredAt: new Date().toISOString(),
        payload: {},
      };

      expect(() => serializer.deserialize(data)).toThrow("Unknown event type: 'UnknownEvent'");
    });
  });

  describe('round-trip serialization', () => {
    beforeEach(() => {
      registry.register(TestEvent);
      registry.register(TestEventWithAggregate);
      registry.register(ThreeFieldEvent);
    });

    it('should preserve event data through serialize/deserialize', () => {
      const original = new TestEvent('roundtrip', 999);
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize<TestEvent>(serialized);

      expect(deserialized.value).toBe(original.value);
      expect(deserialized.count).toBe(original.count);
    });

    it('should handle event with multiple constructor arguments', () => {
      const original = new TestEventWithAggregate('multi', 'agg-multi');
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize<TestEventWithAggregate>(serialized);

      expect(deserialized.value).toBe(original.value);
      expect(deserialized.aggregateId).toBe(original.aggregateId);
    });

    it('BUG-04 필드 3개 이상 이벤트의 직렬화 라운드트립에서 생성자 인자 순서를 보장해야 한다', () => {
      const original = new ThreeFieldEvent('alpha', 7, true);
      const serialized = serializer.serialize(original);

      const reorderedPayload = {
        c: serialized.payload.c,
        a: serialized.payload.a,
        b: serialized.payload.b,
      };

      expect(() =>
        serializer.deserialize<ThreeFieldEvent>({
          ...serialized,
          payload: reorderedPayload,
        })
      ).toThrow(EventDeserializationError);
    });
  });

  describe('with global registry', () => {
    it('should use global registry by default', () => {
      const defaultSerializer = new DefaultEventSerializer();

      globalEventRegistry.register(RegisteredEvent);

      const data: SerializedEvent = {
        eventType: 'RegisteredEvent',
        eventId: 'evt_global_123',
        occurredAt: new Date().toISOString(),
        payload: {
          data: 'registered',
        },
      };

      const event = defaultSerializer.deserialize<RegisteredEvent>(data);

      expect(event).toBeInstanceOf(RegisteredEvent);
      expect(event.data).toBe('registered');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      registry.register(TestEvent);
    });

    it('should handle event with no custom properties', () => {
      class EmptyEvent extends DomainEvent {
        static readonly eventName = 'EmptyEvent';
      }
      registry.register(EmptyEvent);

      const original = new EmptyEvent();
      const serialized = serializer.serialize(original);
      expect(() => serializer.deserialize<EmptyEvent>(serialized)).toThrow(EventDeserializationError);
    });

    it('should handle event with complex payload values', () => {
      class ComplexEvent extends DomainEvent {
        static readonly eventName = 'ComplexEvent';
        constructor(
          public readonly nested: Record<string, unknown>,
          public readonly array: number[]
        ) {
          super();
        }
      }
      registry.register(ComplexEvent);

      const original = new ComplexEvent({ key: 'value' }, [1, 2, 3]);
      const serialized = serializer.serialize(original);
      expect(() => serializer.deserialize<ComplexEvent>(serialized)).toThrow(EventDeserializationError);
    });
  });
});
