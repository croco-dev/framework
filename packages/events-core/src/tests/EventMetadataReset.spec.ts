import { beforeEach, describe, expect, it } from "vitest";
import { Container } from "@croco/framework-context";
import {
  DefaultHandlerResolver,
  DomainEvent,
  EventBusConfig,
  EventRegistry,
  getEventHandlerSubscriptions,
  RegisterEvent,
  RegisterEventHandler,
} from "../index";

import type { EventBus, EventHandler } from "../index";

@RegisterEvent()
class OrderPlaced extends DomainEvent {
  static eventName = "order.placed";

  constructor(readonly orderId: string) {
    super();
  }
}

@RegisterEventHandler(OrderPlaced)
class OrderPlacedHandler implements EventHandler<OrderPlaced> {
  handle(_event: OrderPlaced): void {}
}

describe("decorator metadata across Container.reset()", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("keeps @RegisterEventHandler subscriptions declared at module load", () => {
    expect(getEventHandlerSubscriptions(OrderPlacedHandler)).toHaveLength(1);
  });

  it("keeps @RegisterEvent classes available to EventRegistry.fromMetadata()", () => {
    expect(EventRegistry.fromMetadata().has("order.placed")).toBe(true);
  });

  it("subscribes a decorated handler passed to EventBusConfig.start()", async () => {
    const subscribed: string[] = [];
    const bus = {
      subscribe: (subscription: { eventName: string }) => {
        subscribed.push(subscription.eventName);
      },
      unsubscribe: () => undefined,
      clear: () => undefined,
    } as unknown as EventBus;
    const config = new EventBusConfig();
    config.setEventBus(bus);

    await config.start({
      handlers: [OrderPlacedHandler],
      resolver: new DefaultHandlerResolver(),
    });

    expect(subscribed).toEqual(["order.placed"]);
  });
});
