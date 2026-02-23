import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainEvent } from '../libs/DomainEvent';
import type { EventBus } from '../libs/EventBus';
import { EventBusConfig } from '../libs/EventBusConfig';
import { EventPublisher } from '../libs/EventPublisher';

class TestEvent extends DomainEvent {
  static eventName = 'TestEvent';
  constructor(public readonly data: string) {
    super();
  }
}

class EventA extends DomainEvent {
  static eventName = 'EventA';
}

class EventB extends DomainEvent {
  static eventName = 'EventB';
}

class EventC extends DomainEvent {
  static eventName = 'EventC';
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
    publisher = new EventPublisher(config);
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
      let resolvePublish!: () => void;
      const asyncMockEventBus = {
        async publish(_event: DomainEvent): Promise<void> {
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

    it('BUG-08 EventA/EventB/EventC 배치 발행은 순차 실행을 보장해야 한다', async () => {
      const completionOrder: string[] = [];
      let inFlightCount = 0;
      let maxInFlightCount = 0;
      const delayByEventName: Record<string, number> = {
        EventA: 50,
        EventB: 20,
        EventC: 0,
      };

      const latencyEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          inFlightCount += 1;
          maxInFlightCount = Math.max(maxInFlightCount, inFlightCount);

          await new Promise((resolve) => setTimeout(resolve, delayByEventName[event.eventName] ?? 0));
          completionOrder.push(event.eventName);

          inFlightCount -= 1;
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(latencyEventBus);

      await publisher.publishMany([new EventA(), new EventB(), new EventC()]);

      expect(completionOrder).toEqual(['EventA', 'EventB', 'EventC']);
      expect(maxInFlightCount).toBe(1);
    });

    it('BUG-05 하나 실패해도 나머지 이벤트를 발행하고 실패 정보를 로깅해야 한다', async () => {
      const failure = new Error('Failed on second event');
      const publishOrder: string[] = [];
      const partialFailureEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          const data = (event as TestEvent).data;
          publishOrder.push(data);

          if (data === 'second') {
            throw failure;
          }
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(partialFailureEventBus);

      const events = [new TestEvent('first'), new TestEvent('second'), new TestEvent('third')];
      const results = await publisher.publishMany(events);

      expect(publishOrder).toEqual(['first', 'second', 'third']);
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe(failure);
      expect(results[2].success).toBe(true);
    });

    it('should handle single event array', async () => {
      const events = [new TestEvent('single')];

      await publisher.publishMany(events);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      expect(mockEventBus.publishedEvents[0]).toBe(events[0]);
    });
  });

  describe('publishManyParallel', () => {
    it('should process events concurrently for latency-optimized workloads', async () => {
      const completionOrder: string[] = [];
      let inFlightCount = 0;
      let maxInFlightCount = 0;
      const delayByEventName: Record<string, number> = {
        EventA: 50,
        EventB: 20,
        EventC: 0,
      };

      const latencyEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          inFlightCount += 1;
          maxInFlightCount = Math.max(maxInFlightCount, inFlightCount);

          await new Promise((resolve) => setTimeout(resolve, delayByEventName[event.eventName] ?? 0));
          completionOrder.push(event.eventName);

          inFlightCount -= 1;
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(latencyEventBus);

      await publisher.publishManyParallel([new EventA(), new EventB(), new EventC()]);

      expect(completionOrder).toEqual(['EventC', 'EventB', 'EventA']);
      expect(maxInFlightCount).toBeGreaterThan(1);
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
