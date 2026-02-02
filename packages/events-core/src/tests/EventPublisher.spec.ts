import { beforeEach, describe, expect, it } from 'vitest';
import { DomainEvent } from '../libs/DomainEvent';
import type { EventBus } from '../libs/EventBus';
import { EventBusConfig } from '../libs/EventBusConfig';
import { EventPublisher } from '../libs/EventPublisher';

class TestEvent extends DomainEvent {
  constructor(public readonly data: string) {
    super();
  }
}

class MockEventBus implements EventBus {
  public publishedEvents: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  subscribe(): void {}

  unsubscribe(): void {}

  clear(): void {
    this.publishedEvents = [];
  }
}

describe('EventPublisher', () => {
  let publisher!: EventPublisher;
  let mockEventBus!: MockEventBus;
  let config!: EventBusConfig;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    config = EventBusConfig.getInstance();
    config.setEventBus(mockEventBus);
    publisher = new EventPublisher();
  });

  describe('publish', () => {
    it('should publish event through event bus', async () => {
      const event = new TestEvent('test-data');

      await publisher.publish(event);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      expect(mockEventBus.publishedEvents[0]).toBe(event);
    });

    it('should publish multiple events sequentially', async () => {
      const event1 = new TestEvent('first');
      const event2 = new TestEvent('second');

      await publisher.publish(event1);
      await publisher.publish(event2);

      expect(mockEventBus.publishedEvents).toHaveLength(2);
      expect(mockEventBus.publishedEvents[0]).toBe(event1);
      expect(mockEventBus.publishedEvents[1]).toBe(event2);
    });

    it('should handle async event bus publish', async () => {
      let resolvePublish!: (value: void) => void;
      const asyncMockEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          return new Promise((resolve) => {
            resolvePublish = resolve;
          });
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(asyncMockEventBus);

      const publishPromise = publisher.publish(new TestEvent('async'));

      expect(publishPromise).toBeInstanceOf(Promise);

      resolvePublish();
      await publishPromise;
    });

    it('should propagate event bus errors', async () => {
      const errorEventBus = {
        async publish(): Promise<void> {
          throw new Error('Event bus error');
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(errorEventBus);

      await expect(publisher.publish(new TestEvent('error'))).rejects.toThrow('Event bus error');
    });
  });

  describe('publishMany', () => {
    it('should publish multiple events in order', async () => {
      const events = [new TestEvent('event-1'), new TestEvent('event-2'), new TestEvent('event-3')];

      await publisher.publishMany(events);

      expect(mockEventBus.publishedEvents).toHaveLength(3);
      expect(mockEventBus.publishedEvents[0]).toBe(events[0]);
      expect(mockEventBus.publishedEvents[1]).toBe(events[1]);
      expect(mockEventBus.publishedEvents[2]).toBe(events[2]);
    });

    it('should handle empty array', async () => {
      await publisher.publishMany([]);

      expect(mockEventBus.publishedEvents).toHaveLength(0);
    });

    it('should publish events sequentially (not in parallel)', async () => {
      const order: string[] = [];
      const sequentialEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          order.push((event as TestEvent).data);
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(sequentialEventBus);

      const events = [new TestEvent('first'), new TestEvent('second'), new TestEvent('third')];

      await publisher.publishMany(events);

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('should stop publishing on first error', async () => {
      let callCount = 0;
      const failingEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          callCount++;
          if (callCount === 2) {
            throw new Error('Failed on second event');
          }
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(failingEventBus);

      const events = [new TestEvent('first'), new TestEvent('second'), new TestEvent('third')];

      await expect(publisher.publishMany(events)).rejects.toThrow('Failed on second event');
      expect(callCount).toBe(2);
    });

    it('should handle single event array', async () => {
      const events = [new TestEvent('single')];

      await publisher.publishMany(events);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      expect(mockEventBus.publishedEvents[0]).toBe(events[0]);
    });
  });

  describe('event bus integration', () => {
    it('should use event bus from config', async () => {
      const event = new TestEvent('config-test');

      await publisher.publish(event);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
    });

    it('should dynamically use updated event bus', async () => {
      const firstEventBus = new MockEventBus();
      const secondEventBus = new MockEventBus();

      config.setEventBus(firstEventBus);
      await publisher.publish(new TestEvent('first'));

      config.setEventBus(secondEventBus);
      await publisher.publish(new TestEvent('second'));

      expect(firstEventBus.publishedEvents).toHaveLength(1);
      expect(secondEventBus.publishedEvents).toHaveLength(1);
      expect((firstEventBus.publishedEvents[0] as TestEvent).data).toBe('first');
      expect((secondEventBus.publishedEvents[0] as TestEvent).data).toBe('second');
    });
  });
});
