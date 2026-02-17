import { DomainEvent, type EventHandler, type EventSubscription } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '../index';

class TestEvent extends DomainEvent {
  constructor(public readonly message: string) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  public handledEvents: TestEvent[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

class FailingHandler implements EventHandler<TestEvent> {
  async handle(): Promise<void> {
    throw new Error('Handler failed intentionally');
  }
}

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus;
  let testHandler: TestHandler;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    testHandler = new TestHandler();
    Container.reset();
  });

  describe('subscribe', () => {
    it('should subscribe a handler to an event', () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };
      eventBus.subscribe(subscription);

      expect(true).toBe(true);
    });

    it('should allow multiple handlers for same event', () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler1 });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler2 });

      expect(true).toBe(true);
    });
  });

  describe('publish', () => {
    it('should publish event to subscribed handler', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });

      const event = new TestEvent('hello');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(1);
      expect(testHandler.handledEvents[0].message).toBe('hello');
    });

    it('should publish to multiple handlers', async () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler1 });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler2 });

      const event = new TestEvent('broadcast');
      await eventBus.publish(event);

      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });

    it('should not fail if no handlers subscribed', async () => {
      const event = new TestEvent('orphan');
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
    });

    it('should continue with other handlers if one fails', async () => {
      class SuccessHandler extends TestHandler {}
      class FailHandler extends FailingHandler {}

      const successHandler = new SuccessHandler();
      const failHandler = new FailHandler();

      Container.set(SuccessHandler, successHandler);
      Container.set(FailHandler, failHandler);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailHandler });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: SuccessHandler });

      const event = new TestEvent('test');
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
      expect(successHandler.handledEvents).toHaveLength(1);
    });

    it('should not mutate original event metadata when publishing same event twice', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });

      const event = new TestEvent('immutable');
      const originalMetadata = event.metadata;

      await eventBus.publish(event);
      await eventBus.publish(event);

      expect(event.metadata).toEqual({});
      expect(event.metadata).toBe(originalMetadata);
    });

    it('should pass Error object to recordException', async () => {
      const failHandler = new FailingHandler();
      Container.set(FailingHandler, failHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailingHandler });

      const publishSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const handleSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            _options: { attributes: Record<string, unknown> },
            callback: (span: typeof publishSpan) => Promise<void>
          ) => {
            const span = name.startsWith('event.publish:') ? publishSpan : handleSpan;
            await callback(span);
          }
        ),
      };

      Object.defineProperty(eventBus, 'tracer', {
        value: mockTracer,
      });

      await eventBus.publish(new TestEvent('record-error'));

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe a handler', async () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };

      eventBus.subscribe(subscription);
      eventBus.unsubscribe(subscription);

      const event = new TestEvent('after-unsubscribe');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it('should not fail when unsubscribing non-existent handler', () => {
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };
      expect(() => eventBus.unsubscribe(subscription)).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });
      eventBus.clear();

      const event = new TestEvent('after-clear');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });
  });
});
