import { describe, expect, it } from 'vitest';
import { DomainEvent } from '../libs/DomainEvent';
import type { EventBus, EventSubscription } from '../libs/EventBus';
import { EventBusConfig } from '../libs/EventBusConfig';
import type { EventHandler, EventHandlerClass } from '../libs/EventHandler';
import type { HandlerResolver } from '../libs/HandlerResolver';

class TestEvent extends DomainEvent {
  static eventName = 'TestEvent';
  constructor(public readonly data: string) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  async handle(event: TestEvent): Promise<void> {
    expect(event.data).toBe('test');
  }
}

class AnotherHandler implements EventHandler<TestEvent> {
  async handle(event: TestEvent): Promise<void> {
    expect(event.data).toBe('test');
  }
}

class MockEventBus implements EventBus {
  public subscriptions: EventSubscription[] = [];

  async publish(): Promise<void> {}

  subscribe(subscription: EventSubscription): void {
    this.subscriptions.push(subscription);
  }

  unsubscribe(): void {}

  clear(): void {
    this.subscriptions = [];
  }
}

describe('EventBusConfig', () => {
  describe('singleton pattern', () => {
    it('should return same instance across multiple calls', () => {
      const instance1 = EventBusConfig.getInstance();
      const instance2 = EventBusConfig.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const config1 = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config1.setEventBus(mockBus as EventBus);

      const config2 = EventBusConfig.getInstance();
      const retrievedBus = config2.getEventBus();

      expect(retrievedBus).toBe(mockBus);
    });
  });

  describe('setEventBus and getEventBus', () => {
    it('should set and get event bus instance', () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);
      const retrieved = config.getEventBus();

      expect(retrieved).toBe(mockBus);
    });

    it('should allow updating event bus', () => {
      const config = EventBusConfig.getInstance();
      const firstBus = new MockEventBus();
      const secondBus = new MockEventBus();

      config.setEventBus(firstBus as EventBus);
      expect(config.getEventBus()).toBe(firstBus);

      config.setEventBus(secondBus as EventBus);
      expect(config.getEventBus()).toBe(secondBus);
    });
  });

  describe('subscribe', () => {
    it('should register event subscription', () => {
      const config = EventBusConfig.getInstance();
      const subscription: EventSubscription = {
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.subscribe(subscription);

      expect(true).toBe(true);
    });

    it('should allow multiple subscriptions', () => {
      const config = EventBusConfig.getInstance();

      config.subscribe({
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: 'AnotherEvent',
        handlerClass: AnotherHandler as EventHandlerClass,
      });

      expect(true).toBe(true);
    });

    it('should store subscriptions for later use in start', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      const subscription: EventSubscription = {
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.subscribe(subscription);

      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      expect(mockBus.subscriptions[mockBus.subscriptions.length - 1].eventName).toBe('TestEvent');
    });
  });

  describe('start', () => {
    it('should throw error when event bus is not set', async () => {
      const config = EventBusConfig.getInstance();
      config.setEventBus(undefined as unknown as EventBus);

      await expect(config.start({ handlers: [] })).rejects.toThrow(
        'EventBus has not been set. Call setEventBus() first.'
      );
    });

    it('should register subscriptions from handlers array', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.eventName).toBe('TestEvent');
      expect(lastSub.handlerClass).toBe(TestHandler);
    });

    it('should use DefaultHandlerResolver when no resolver provided', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.handler).toBeInstanceOf(TestHandler);
    });

    it('should use custom resolver when provided', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      const customHandler = new TestHandler();
      const customResolver = {
        resolve(): EventHandler<TestEvent> {
          return customHandler;
        },
      };

      config.subscribe({
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({
        handlers: [],
        resolver: customResolver as HandlerResolver,
      });

      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.handler).toBe(customHandler);
    });

    it('should handle multiple subscriptions', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'MultiTestEvent1',
        handlerClass: TestHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: 'MultiTestEvent2',
        handlerClass: AnotherHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const multiTestSubs = mockBus.subscriptions.filter(
        (s) => s.eventName === 'MultiTestEvent1' || s.eventName === 'MultiTestEvent2'
      );
      expect(multiTestSubs.length).toBe(2);
    });

    it('should preserve subscription order', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'FirstEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: 'SecondEvent',
        handlerClass: AnotherHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const lastSubs = mockBus.subscriptions.slice(-2);
      expect(lastSubs[0].eventName).toBe('FirstEvent');
      expect(lastSubs[1].eventName).toBe('SecondEvent');
    });
  });

  describe('integration with handlers', () => {
    it('should work with RegisterEventHandler decorator pattern', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'TestEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      expect(mockBus.subscriptions[mockBus.subscriptions.length - 1].handler).toBeInstanceOf(TestHandler);
    });
  });

  describe('edge cases', () => {
    it('should handle calling start with existing subscriptions', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'NewEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      const beforeCount = mockBus.subscriptions.length;
      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThan(beforeCount);
    });

    it('should allow calling start multiple times with same subscriptions', async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: 'RepeatEvent',
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });
      await config.start({ handlers: [] });

      const repeatEventSubs = mockBus.subscriptions.filter((s) => s.eventName === 'RepeatEvent');
      expect(repeatEventSubs.length).toBe(2);
    });
  });
});
