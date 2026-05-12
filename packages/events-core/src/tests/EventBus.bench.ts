import { Container } from "@croco/framework-context";
import { bench, describe } from "vitest";

import { DomainEvent } from "../libs/DomainEvent";
import type { EventBus } from "../libs/EventBus";
import { EventBusConfig } from "../libs/EventBusConfig";
import type { EventHandler } from "../libs/EventHandler";
import { RegisterEventHandler } from "../libs/EventHandler";
import { EventPublisher } from "../libs/EventPublisher";
import { DefaultHandlerResolver } from "../libs/HandlerResolver";
import type { EventSubscription } from "../libs/types/EventSubscription";

class MockEventBus implements EventBus {
  subscribedEvents: EventSubscription[] = [];
  publishedEvents: DomainEvent[] = [];

  subscribe(subscription: EventSubscription): void {
    this.subscribedEvents.push(subscription);
  }

  unsubscribe(subscription: EventSubscription): void {
    this.subscribedEvents = this.subscribedEvents.filter(
      (entry) =>
        entry.eventName !== subscription.eventName ||
        entry.handlerClass !== subscription.handlerClass,
    );
  }

  clear(): void {
    this.subscribedEvents = [];
    this.publishedEvents = [];
  }

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }
}

class BenchEvent extends DomainEvent {
  static eventName = "BenchEvent";
  constructor(public readonly data: string) {
    super();
  }
}

@RegisterEventHandler(BenchEvent)
class BenchHandler implements EventHandler<BenchEvent> {
  async handle(_event: BenchEvent): Promise<void> {}
}

@RegisterEventHandler(BenchEvent)
class BenchHandler1 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler2 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler3 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler4 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler5 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler6 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler7 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler8 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler9 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}
@RegisterEventHandler(BenchEvent)
class BenchHandler10 implements EventHandler<BenchEvent> {
  async handle(): Promise<void> {}
}

const predefinedHandlers = [
  BenchHandler1,
  BenchHandler2,
  BenchHandler3,
  BenchHandler4,
  BenchHandler5,
  BenchHandler6,
  BenchHandler7,
  BenchHandler8,
  BenchHandler9,
  BenchHandler10,
];

describe("EventBus benchmarks", () => {
  describe("EventBusConfig.start (10 handlers)", () => {
    bench(
      "should register 10 handlers",
      async () => {
        EventBusConfig.setInstance(new EventBusConfig());
        Container.reset();

        const config = EventBusConfig.getInstance();
        const mockBus = new MockEventBus();

        config.setEventBus(mockBus);

        await config.start({ handlers: predefinedHandlers });
      },
      { iterations: 50, warmupIterations: 5 },
    );
  });

  describe("EventPublisher.publish single event", () => {
    bench(
      "should publish single event",
      async () => {
        EventBusConfig.setInstance(new EventBusConfig());
        Container.reset();

        const config = EventBusConfig.getInstance();
        const mockBus = new MockEventBus();

        config.setEventBus(mockBus);
        await config.start({ handlers: [BenchHandler] });

        const publisher = new EventPublisher(config);
        await publisher.publishNow(new BenchEvent("test-data"));
      },
      { iterations: 200, warmupIterations: 20 },
    );
  });

  describe("DefaultHandlerResolver.resolve × 10", () => {
    bench(
      "should resolve 10 handlers",
      () => {
        const resolver = new DefaultHandlerResolver();
        for (let i = 0; i < 10; i++) {
          resolver.resolve(BenchHandler);
        }
      },
      { iterations: 200, warmupIterations: 20 },
    );
  });
});
