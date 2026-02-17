import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    it('should preserve event order regardless of per-event latency', async () => {
      const completionOrder: string[] = [];
      const delayByEventData: Record<string, number> = {
        first: 30,
        second: 10,
        third: 0,
      };

      const latencyEventBus = {
        async publish(event: DomainEvent): Promise<void> {
          const data = (event as TestEvent).data;
          await new Promise((resolve) => setTimeout(resolve, delayByEventData[data] ?? 0));
          completionOrder.push(data);
        },
        subscribe(): void {},
        unsubscribe(): void {},
        clear(): void {},
      } satisfies EventBus;

      config.setEventBus(latencyEventBus);

      const events = [new TestEvent('first'), new TestEvent('second'), new TestEvent('third')];

      await publisher.publishMany(events);

      expect(completionOrder).toEqual(['first', 'second', 'third']);
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

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      config.setEventBus(partialFailureEventBus);

      const events = [new TestEvent('first'), new TestEvent('second'), new TestEvent('third')];

      await expect(publisher.publishMany(events)).resolves.toBeUndefined();
      expect(publishOrder).toEqual(['first', 'second', 'third']);
      expect(errorSpy).toHaveBeenCalledWith('[EventPublisher] Failed to publish event: TestEvent', failure);

      errorSpy.mockRestore();
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
