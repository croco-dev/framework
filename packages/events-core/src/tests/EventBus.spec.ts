import { beforeEach, describe, expect, it } from "vitest";
import { DomainEvent } from "../libs/DomainEvent";
import type { EventBus } from "../libs/EventBus";
import type { EventHandler, EventHandlerClass } from "../libs/EventHandler";
import type { EventSubscription } from "../libs/types/EventSubscription";

class TestEvent extends DomainEvent {
  static eventName = "TestEvent";
  constructor(public readonly value: string) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  public handledEvents: TestEvent[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

class MockEventBus implements EventBus {
  private readonly subscriptions: Map<string, EventHandler[]> = new Map();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.eventName) ?? [];
    await Promise.all(handlers.map((h) => h.handle(event as TestEvent)));
  }

  subscribe(subscription: EventSubscription): void {
    if (!subscription.handler) {
      return;
    }

    if (!this.subscriptions.has(subscription.eventName)) {
      this.subscriptions.set(subscription.eventName, []);
    }

    const handlers = this.subscriptions.get(subscription.eventName);
    if (handlers) {
      handlers.push(subscription.handler);
    }
  }

  unsubscribe(subscription: EventSubscription): void {
    if (!subscription.handler) {
      return;
    }

    const handlers = this.subscriptions.get(subscription.eventName);
    if (handlers) {
      const index = handlers.indexOf(subscription.handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

describe("EventBus interface contract", () => {
  let eventBus!: MockEventBus;
  let handler!: TestHandler;

  beforeEach(() => {
    eventBus = new MockEventBus();
    handler = new TestHandler();
  });

  describe("publish", () => {
    it("should deliver events to subscribed handlers", async () => {
      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler,
      };

      eventBus.subscribe(subscription);

      const event = new TestEvent("test-value");
      await eventBus.publish(event);

      expect(handler.handledEvents).toHaveLength(1);
      expect(handler.handledEvents[0].value).toBe("test-value");
    });

    it("should handle events with no subscribers", async () => {
      const event = new TestEvent("orphan");

      await expect(eventBus.publish(event)).resolves.toBeUndefined();
    });

    it("should support async handlers", async () => {
      let handlerExecuted = false;

      const asyncHandler: EventHandler<TestEvent> = {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          handlerExecuted = true;
        },
      };

      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: asyncHandler,
      };

      eventBus.subscribe(subscription);

      const event = new TestEvent("async-test");
      await eventBus.publish(event);

      expect(handlerExecuted).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("should register handler for specific event", async () => {
      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler,
      };

      eventBus.subscribe(subscription);

      const event = new TestEvent("after-subscribe");
      await eventBus.publish(event);

      expect(handler.handledEvents).toHaveLength(1);
    });

    it("should allow multiple handlers for same event", async () => {
      const handler1: TestHandler = new TestHandler();
      const handler2: TestHandler = new TestHandler();

      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: handler1,
      });
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: handler2,
      });

      const event = new TestEvent("broadcast");
      await eventBus.publish(event);

      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });
  });

  describe("unsubscribe", () => {
    it("should remove handler subscription", async () => {
      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler,
      };

      eventBus.subscribe(subscription);
      eventBus.unsubscribe(subscription);

      const event = new TestEvent("after-unsubscribe");
      await eventBus.publish(event);

      expect(handler.handledEvents).toHaveLength(0);
    });

    it("should handle unsubscribe of non-existent subscription", () => {
      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler,
      };

      expect(() => eventBus.unsubscribe(subscription)).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should remove all subscriptions", async () => {
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler,
      });

      eventBus.clear();

      const event = new TestEvent("after-clear");
      await eventBus.publish(event);

      expect(handler.handledEvents).toHaveLength(0);
    });
  });

  describe("event isolation", () => {
    it("should not deliver event to handlers of different event type", async () => {
      class OtherEvent extends DomainEvent {
        static eventName = "OtherEvent";
        constructor(public readonly data: string) {
          super();
        }
      }

      const otherHandler: EventHandler<OtherEvent> = {
        async handle(): Promise<void> {
          throw new Error("Should not be called");
        },
      };

      eventBus.subscribe({
        eventName: "OtherEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: otherHandler,
      });

      const testEvent = new TestEvent("test");
      await eventBus.publish(testEvent);

      expect(handler.handledEvents).toHaveLength(0);
    });

    it("should handle multiple event types independently", async () => {
      class FirstEvent extends DomainEvent {
        static eventName = "FirstEvent";
        constructor(public readonly first: string) {
          super();
        }
      }

      class SecondEvent extends DomainEvent {
        static eventName = "SecondEvent";
        constructor(public readonly second: string) {
          super();
        }
      }

      let firstHandlerCalled = false;
      let secondHandlerCalled = false;

      const firstHandler: EventHandler<FirstEvent> = {
        async handle(event): Promise<void> {
          expect(event.first).toBe("first-value");
          firstHandlerCalled = true;
        },
      };

      const secondHandler: EventHandler<SecondEvent> = {
        async handle(event): Promise<void> {
          expect(event.second).toBe("second-value");
          secondHandlerCalled = true;
        },
      };

      eventBus.subscribe({
        eventName: "FirstEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: firstHandler,
      });
      eventBus.subscribe({
        eventName: "SecondEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: secondHandler,
      });

      await eventBus.publish(new FirstEvent("first-value"));
      await eventBus.publish(new SecondEvent("second-value"));

      expect(firstHandlerCalled).toBe(true);
      expect(secondHandlerCalled).toBe(true);
    });
  });

  describe("channel isolation", () => {
    it("should isolate events by event name", async () => {
      class ChannelAEvent extends DomainEvent {
        static eventName = "ChannelAEvent";
      }
      class ChannelBEvent extends DomainEvent {
        static eventName = "ChannelBEvent";
      }

      let channelACalled = false;
      let channelBCalled = false;

      const handlerA: EventHandler<ChannelAEvent> = {
        async handle(): Promise<void> {
          channelACalled = true;
        },
      };

      const handlerB: EventHandler<ChannelBEvent> = {
        async handle(): Promise<void> {
          channelBCalled = true;
        },
      };

      eventBus.subscribe({
        eventName: "ChannelAEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: handlerA,
      });
      eventBus.subscribe({
        eventName: "ChannelBEvent",
        handlerClass: TestHandler as EventHandlerClass,
        handler: handlerB,
      });

      await eventBus.publish(new ChannelAEvent());
      await eventBus.publish(new ChannelBEvent());

      expect(channelACalled).toBe(true);
      expect(channelBCalled).toBe(true);
    });
  });
});
