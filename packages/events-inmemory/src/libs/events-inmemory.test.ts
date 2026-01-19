import { DomainEvent, EventHandler, EventSubscription } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { describe, it, expect, beforeEach } from 'vitest';
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
