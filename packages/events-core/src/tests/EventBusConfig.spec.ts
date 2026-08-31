import { Container, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainEvent } from "../libs/DomainEvent";
import type { EventBus } from "../libs/EventBus";
import { EventBusConfig } from "../libs/EventBusConfig";
import {
  type EventHandler,
  type EventHandlerClass,
  RegisterEventHandler,
} from "../libs/EventHandler";
import type { HandlerResolver } from "../libs/HandlerResolver";
import type { EventSubscription } from "../libs/types/EventSubscription";

class TestEvent extends DomainEvent {
  static eventName = "TestEvent";
  constructor(public readonly data: string) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  async handle(event: TestEvent): Promise<void> {
    expect(event.data).toBe("test");
  }
}

class AnotherHandler implements EventHandler<TestEvent> {
  async handle(event: TestEvent): Promise<void> {
    expect(event.data).toBe("test");
  }
}

class MockEventBus implements EventBus {
  public subscriptions: EventSubscription[] = [];

  async publish(): Promise<void> {}

  subscribe(subscription: EventSubscription): void {
    this.subscriptions.push(subscription);
  }

  unsubscribe(subscription: EventSubscription): void {
    this.subscriptions = this.subscriptions.filter(
      (entry) =>
        entry.eventName !== subscription.eventName ||
        entry.handlerClass !== subscription.handlerClass,
    );
  }

  clear(): void {
    this.subscriptions = [];
  }
}

describe("EventBusConfig", () => {
  beforeEach(() => {
    EventBusConfig.setInstance(new EventBusConfig());
    MetadataStorage.clear();
  });

  describe("singleton pattern", () => {
    it("should return same instance across multiple calls", () => {
      const instance1 = EventBusConfig.getInstance();
      const instance2 = EventBusConfig.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should maintain state across getInstance calls", () => {
      const config1 = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config1.setEventBus(mockBus as EventBus);

      const config2 = EventBusConfig.getInstance();
      const retrievedBus = config2.getEventBus();

      expect(retrievedBus).toBe(mockBus);
    });

    it("should bind scoped disposal to the scope that captured it", () => {
      const firstScope = Container.createScope();
      const secondScope = Container.createScope();
      const firstConfig = firstScope.run(() => EventBusConfig.getInstance());
      const secondConfig = secondScope.run(() => EventBusConfig.getInstance());
      const disposeFirstScope = firstScope.run(() => EventBusConfig.captureCurrentScopeDisposer());

      secondScope.run(() => disposeFirstScope?.());

      expect(firstScope.run(() => EventBusConfig.getInstance())).not.toBe(firstConfig);
      expect(secondScope.run(() => EventBusConfig.getInstance())).toBe(secondConfig);
      firstScope.dispose();
      secondScope.dispose();
    });
  });

  describe("setEventBus and getEventBus", () => {
    it("should set and get event bus instance", () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);
      const retrieved = config.getEventBus();

      expect(retrieved).toBe(mockBus);
    });

    it("should allow updating event bus", () => {
      const config = EventBusConfig.getInstance();
      const firstBus = new MockEventBus();
      const secondBus = new MockEventBus();

      config.setEventBus(firstBus as EventBus);
      expect(config.getEventBus()).toBe(firstBus);

      config.setEventBus(secondBus as EventBus);
      expect(config.getEventBus()).toBe(secondBus);
    });

    it("should keep subscriptions isolated for handlers with the same class name", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();
      const firstHandler = class SharedHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {}
      };
      const secondHandler = class SharedHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {}
      };

      config.setEventBus(mockBus as EventBus);
      config.subscribe({
        eventName: "TestEvent",
        handlerClass: firstHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: "TestEvent",
        handlerClass: secondHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      expect(mockBus.subscriptions).toHaveLength(2);
      expect(mockBus.subscriptions[0].handlerClass).toBe(firstHandler);
      expect(mockBus.subscriptions[1].handlerClass).toBe(secondHandler);
    });

    it("should disconnect subscriptions from the previous bus when switching buses", async () => {
      const config = EventBusConfig.getInstance();
      const firstBus = new MockEventBus();
      const secondBus = new MockEventBus();

      config.setEventBus(firstBus as EventBus);
      config.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });
      await config.start({ handlers: [] });

      expect(firstBus.subscriptions).toHaveLength(1);

      config.setEventBus(secondBus as EventBus);

      expect(firstBus.subscriptions).toHaveLength(0);
      expect(secondBus.subscriptions).toHaveLength(0);

      await config.start({ handlers: [] });

      expect(secondBus.subscriptions).toHaveLength(1);
    });

    it("should resolve subscriptions again after event bus is updated and restarted", async () => {
      const config = EventBusConfig.getInstance();
      const firstBus = new MockEventBus();
      const secondBus = new MockEventBus();
      const firstHandler = new TestHandler();
      const secondHandler = new TestHandler();
      const firstResolver = {
        resolve(): EventHandler<TestEvent> {
          return firstHandler;
        },
      };
      const secondResolver = {
        resolve(): EventHandler<TestEvent> {
          return secondHandler;
        },
      };

      config.setEventBus(firstBus as EventBus);
      config.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });
      await config.start({ handlers: [], resolver: firstResolver as HandlerResolver });

      config.setEventBus(secondBus as EventBus);

      expect(firstBus.subscriptions).toHaveLength(0);
      expect(secondBus.subscriptions).toHaveLength(0);

      await config.start({ handlers: [], resolver: secondResolver as HandlerResolver });

      expect(secondBus.subscriptions).toHaveLength(1);
      expect(secondBus.subscriptions[0]).toMatchObject({
        eventName: "TestEvent",
        handlerClass: TestHandler,
        handler: secondHandler,
      });
    });

    it("should keep handlers with the same class name separate", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();
      const handlerA = new TestHandler();
      const handlerB = new AnotherHandler();
      const HandlerA = class CollisionHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {}
      };
      const HandlerB = class CollisionHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {}
      };
      const resolver = {
        resolve(handlerClass: EventHandlerClass): EventHandler<TestEvent> {
          if (handlerClass === HandlerA) {
            return handlerA;
          }

          return handlerB;
        },
      };

      config.setEventBus(mockBus as EventBus);
      config.subscribe({
        eventName: "CollisionEvent",
        handlerClass: HandlerA as EventHandlerClass,
      });
      config.subscribe({
        eventName: "CollisionEvent",
        handlerClass: HandlerB as EventHandlerClass,
      });

      await config.start({ handlers: [], resolver: resolver as HandlerResolver });

      const collisionSubs = mockBus.subscriptions.filter((s) => s.eventName === "CollisionEvent");
      expect(collisionSubs).toHaveLength(2);
      expect(collisionSubs[0].handlerClass.name).toBe("CollisionHandler");
      expect(collisionSubs[1].handlerClass.name).toBe("CollisionHandler");
      expect(new Set(collisionSubs.map((s) => s.handler)).size).toBe(2);
    });
  });

  describe("subscribe", () => {
    it("should store a registered event subscription", () => {
      const config = EventBusConfig.getInstance();
      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.subscribe(subscription);

      expect(config.getSubscriptions()).toContain(subscription);
    });

    it("should store multiple registered subscriptions", () => {
      const config = EventBusConfig.getInstance();
      const firstSubscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      };
      const secondSubscription: EventSubscription = {
        eventName: "AnotherEvent",
        handlerClass: AnotherHandler as EventHandlerClass,
      };

      config.subscribe(firstSubscription);
      config.subscribe(secondSubscription);

      expect([...config.getSubscriptions()]).toEqual([firstSubscription, secondSubscription]);
    });

    it("should store subscriptions for later use in start", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      const subscription: EventSubscription = {
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.subscribe(subscription);

      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      expect(mockBus.subscriptions[mockBus.subscriptions.length - 1].eventName).toBe("TestEvent");
    });
  });

  describe("resource cleanup", () => {
    it("should unsubscribe started subscriptions", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();
      const subscription: EventSubscription = {
        eventName: "CleanupEvent",
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.setEventBus(mockBus as EventBus);
      config.subscribe(subscription);
      await config.start({ handlers: [] });

      config.unsubscribe(subscription);

      expect(
        mockBus.subscriptions.find((entry) => entry.eventName === "CleanupEvent"),
      ).toBeUndefined();
    });

    it("should clear tracked subscriptions and event bus state", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);
      config.subscribe({
        eventName: "ClearEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });
      await config.start({ handlers: [] });

      config.clear();

      expect(mockBus.subscriptions).toEqual([]);
    });

    it("should allow restarting after clear without stale started subscriptions", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();
      const subscription: EventSubscription = {
        eventName: "ClearRestartEvent",
        handlerClass: TestHandler as EventHandlerClass,
      };

      config.setEventBus(mockBus as EventBus);
      config.subscribe(subscription);
      await config.start({ handlers: [] });

      config.clear();
      config.subscribe(subscription);
      await config.start({ handlers: [] });

      const restartedSubscriptions = mockBus.subscriptions.filter(
        (entry) => entry.eventName === "ClearRestartEvent",
      );
      expect(restartedSubscriptions).toHaveLength(1);
    });
  });

  describe("start", () => {
    it("should throw error when event bus is not set", async () => {
      const config = EventBusConfig.getInstance();
      config.setEventBus(undefined as unknown as EventBus);

      await expect(config.start({ handlers: [] })).rejects.toThrow(
        "EventBus has not been set. Call setEventBus() first.",
      );
    });

    it("should register subscriptions from handlers array metadata", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      @RegisterEventHandler(TestEvent)
      class DecoratedHandler implements EventHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {}
      }

      await config.start({ handlers: [DecoratedHandler] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.eventName).toBe("TestEvent");
      expect(lastSub.handlerClass).toBe(DecoratedHandler);
    });

    it("should use DefaultHandlerResolver when no resolver provided", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.handler).toBeInstanceOf(TestHandler);
    });

    it("should use custom resolver when provided", async () => {
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
        eventName: "TestEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({
        handlers: [],
        resolver: customResolver as HandlerResolver,
      });

      const lastSub = mockBus.subscriptions[mockBus.subscriptions.length - 1];
      expect(lastSub.handler).toBe(customHandler);
    });

    it("should handle multiple subscriptions", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: "MultiTestEvent1",
        handlerClass: TestHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: "MultiTestEvent2",
        handlerClass: AnotherHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const multiTestSubs = mockBus.subscriptions.filter(
        (s) => s.eventName === "MultiTestEvent1" || s.eventName === "MultiTestEvent2",
      );
      expect(multiTestSubs.length).toBe(2);
    });

    it("should preserve subscription order", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: "FirstEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });
      config.subscribe({
        eventName: "SecondEvent",
        handlerClass: AnotherHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });

      const lastSubs = mockBus.subscriptions.slice(-2);
      expect(lastSubs[0].eventName).toBe("FirstEvent");
      expect(lastSubs[1].eventName).toBe("SecondEvent");
    });
  });

  describe("integration with handlers", () => {
    it("should work with RegisterEventHandler decorator pattern", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      @RegisterEventHandler(TestEvent)
      class DecoratedHandler implements EventHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {}
      }

      await config.start({ handlers: [DecoratedHandler] });

      expect(mockBus.subscriptions.length).toBeGreaterThanOrEqual(1);
      expect(mockBus.subscriptions[mockBus.subscriptions.length - 1].handler).toBeInstanceOf(
        DecoratedHandler,
      );
    });
  });

  describe("edge cases", () => {
    it("should handle calling start with existing subscriptions", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: "NewEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });

      const beforeCount = mockBus.subscriptions.length;
      await config.start({ handlers: [] });

      expect(mockBus.subscriptions.length).toBeGreaterThan(beforeCount);
    });

    it("should allow calling start multiple times with same subscriptions", async () => {
      const config = EventBusConfig.getInstance();
      const mockBus = new MockEventBus();

      config.setEventBus(mockBus as EventBus);

      config.subscribe({
        eventName: "RepeatEvent",
        handlerClass: TestHandler as EventHandlerClass,
      });

      await config.start({ handlers: [] });
      await config.start({ handlers: [] });

      const repeatEventSubs = mockBus.subscriptions.filter((s) => s.eventName === "RepeatEvent");
      expect(repeatEventSubs.length).toBe(1);
    });
  });
});
