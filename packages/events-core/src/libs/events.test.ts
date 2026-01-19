import { describe, it, expect, beforeEach } from 'vitest';
import { DomainEvent, AggregateRoot, EventBusConfig, EventHandler, RegisterEventHandler } from '../index';

class TestEvent extends DomainEvent {
  constructor(public readonly data: string) {
    super();
  }
}

class AnotherTestEvent extends DomainEvent {
  constructor(public readonly value: number) {
    super();
  }
}

class TestAggregate extends AggregateRoot {
  public triggerEvent(data: string): void {
    this.addDomainEvent(new TestEvent(data));
  }

  public triggerMultipleEvents(): void {
    this.addDomainEvent(new TestEvent('first'));
    this.addDomainEvent(new AnotherTestEvent(42));
  }
}

describe('DomainEvent', () => {
  it('should have eventName equal to constructor name', () => {
    const event = new TestEvent('test');
    expect(event.eventName).toBe('TestEvent');
  });

  it('should have timestamp set automatically', () => {
    const before = new Date();
    const event = new TestEvent('test');
    const after = new Date();

    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should store provided data', () => {
    const event = new TestEvent('hello');
    expect(event.data).toBe('hello');
  });
});

describe('AggregateRoot', () => {
  let aggregate: TestAggregate;

  beforeEach(() => {
    aggregate = new TestAggregate();
  });

  it('should start with no domain events', () => {
    expect(aggregate.hasDomainEvents()).toBe(false);
    expect(aggregate.getDomainEvents()).toHaveLength(0);
  });

  it('should add domain events', () => {
    aggregate.triggerEvent('test');

    expect(aggregate.hasDomainEvents()).toBe(true);
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });

  it('should return domain events in order', () => {
    aggregate.triggerMultipleEvents();

    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(TestEvent);
    expect(events[1]).toBeInstanceOf(AnotherTestEvent);
  });

  it('should clear domain events', () => {
    aggregate.triggerEvent('test');
    expect(aggregate.hasDomainEvents()).toBe(true);

    aggregate.clearDomainEvents();
    expect(aggregate.hasDomainEvents()).toBe(false);
    expect(aggregate.getDomainEvents()).toHaveLength(0);
  });

  it('should return a copy of events array', () => {
    aggregate.triggerEvent('test');
    const events1 = aggregate.getDomainEvents();
    const events2 = aggregate.getDomainEvents();

    expect(events1).not.toBe(events2);
    expect(events1).toEqual(events2);
  });
});

describe('EventBusConfig', () => {
  let config: EventBusConfig;

  beforeEach(() => {
    config = EventBusConfig.getInstance();
  });

  it('should return singleton instance', () => {
    const instance1 = EventBusConfig.getInstance();
    const instance2 = EventBusConfig.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should set and get event bus', () => {
    const mockEventBus = {
      publish: async () => {},
      subscribe: () => {},
      unsubscribe: () => {},
      clear: () => {},
    };

    config.setEventBus(mockEventBus);
    expect(config.getEventBus()).toBe(mockEventBus);
  });

  it('should subscribe handlers via decorator', () => {
    @RegisterEventHandler(TestEvent)
    class DecoratorTestHandler implements EventHandler<TestEvent> {
      async handle(): Promise<void> {}
    }

    expect(DecoratorTestHandler).toBeDefined();
  });

  it('should start event bus with subscriptions', async () => {
    const subscriptions: { eventName: string; handlerClass: unknown }[] = [];
    const mockEventBus = {
      publish: async () => {},
      subscribe: (sub: { eventName: string; handlerClass: unknown }) => {
        subscriptions.push(sub);
      },
      unsubscribe: () => {},
      clear: () => {},
    };

    @RegisterEventHandler(AnotherTestEvent)
    class StartTestHandler implements EventHandler<AnotherTestEvent> {
      async handle(): Promise<void> {}
    }

    config.setEventBus(mockEventBus);
    await config.start({ handlers: [StartTestHandler] });

    const anotherEventSubscription = subscriptions.find(s => s.eventName === 'AnotherTestEvent');
    expect(anotherEventSubscription).toBeDefined();
  });
});
