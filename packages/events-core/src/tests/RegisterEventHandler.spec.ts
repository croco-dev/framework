import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DefaultHandlerResolver,
  DomainEvent,
  type EventHandler,
  type EventSubscription,
  getEventHandlerSubscriptions,
  RegisterEventHandler,
} from "../index";

class OrderCreated extends DomainEvent {
  static eventName = "order.created";

  constructor(public readonly orderId: string) {
    super();
  }
}

class PaymentCaptured extends DomainEvent {
  static eventName = "payment.captured";

  constructor(public readonly amount: number) {
    super();
  }
}

class UnionOrderCreated extends DomainEvent {
  readonly kind = "order";
}

class UnionPaymentCaptured extends DomainEvent {
  readonly kind = "payment";
}

const UnionEventClass: new () => UnionOrderCreated | UnionPaymentCaptured = UnionOrderCreated;

@RegisterEventHandler(OrderCreated, { eventName: "order.created.v2" })
class OrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(_event: OrderCreated): void {}
}

// @ts-expect-error A PaymentCaptured handler cannot subscribe to OrderCreated events.
@RegisterEventHandler(OrderCreated)
class PaymentCapturedHandler implements EventHandler<PaymentCaptured> {
  handle(_event: PaymentCaptured): void {}
}

class PriorityOrderCreated extends OrderCreated {
  constructor(
    orderId: string,
    public readonly priority: number,
  ) {
    super(orderId);
  }
}

// @ts-expect-error A subtype-only handler cannot subscribe to every OrderCreated event.
@RegisterEventHandler(OrderCreated)
class PriorityOrderCreatedHandler implements EventHandler<PriorityOrderCreated> {
  handle(_event: PriorityOrderCreated): void {}
}

// @ts-expect-error A zero-argument overload cannot hide a subtype-only handler parameter.
@RegisterEventHandler(OrderCreated)
class OverloadedPriorityOrderCreatedHandler implements EventHandler<PriorityOrderCreated> {
  handle(_event: PriorityOrderCreated): void;
  handle(): void;
  handle(_event?: PriorityOrderCreated): void {}
}

// @ts-expect-error Dispatch supplies only the event, so a required second argument is incompatible.
@RegisterEventHandler(OrderCreated)
class RequiredContextOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(): void;
  handle(_event: OrderCreated, _context: string): void;
  handle(_event?: OrderCreated, _context?: string): void {}
}

@RegisterEventHandler(OrderCreated)
class OptionalContextOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(_event: OrderCreated, _context?: string): void {}
}

// @ts-expect-error A handler for one member cannot subscribe to an event constructor union.
@RegisterEventHandler(UnionEventClass)
class UnionOrderOnlyHandler implements EventHandler<UnionOrderCreated> {
  handle(_event: UnionOrderCreated): void {}
}

@RegisterEventHandler(UnionEventClass)
class UnionEventHandler implements EventHandler<UnionOrderCreated | UnionPaymentCaptured> {
  handle(_event: UnionOrderCreated | UnionPaymentCaptured): void {}
}

@RegisterEventHandler(OrderCreated)
class OverloadedOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(_event: OrderCreated): void;
  handle(_event: PaymentCaptured): void;
  handle(_event: OrderCreated | PaymentCaptured): void {}
}

@RegisterEventHandler(OrderCreated)
class OptionalOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(_event?: OrderCreated): void {}
}

@RegisterEventHandler(OrderCreated)
class RestOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(..._events: OrderCreated[]): void {}
}

@RegisterEventHandler(OrderCreated)
class ManyOverloadsOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(_event: OrderCreated): void;
  handle(_event: PaymentCaptured): void;
  handle(_event: PaymentCaptured, _detail: string): void;
  handle(_event: PaymentCaptured, _detail: number): void;
  handle(_event: PaymentCaptured, _detail: boolean): void;
  handle(_event: PaymentCaptured, _detail: symbol): void;
  handle(
    _event: OrderCreated | PaymentCaptured,
    _detail?: string | number | boolean | symbol,
  ): void {}
}

@RegisterEventHandler(OrderCreated)
class GenericOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle<TEvent extends OrderCreated>(_event: TEvent): void {}
}

// @ts-expect-error A subtype-constrained generic handler cannot subscribe to every OrderCreated event.
@RegisterEventHandler(OrderCreated)
class GenericPriorityOrderCreatedHandler implements EventHandler<PriorityOrderCreated> {
  handle<TEvent extends PriorityOrderCreated>(_event: TEvent): void {}
}

@RegisterEventHandler(OrderCreated)
class OverloadedGenericOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle<TEvent extends OrderCreated>(_event: TEvent): void;
  handle<TEvent extends PaymentCaptured>(_event: TEvent): void;
  handle(_event: OrderCreated | PaymentCaptured): void {}
}

@RegisterEventHandler(OrderCreated)
class GenericThenZeroOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle<TEvent extends OrderCreated>(_event: TEvent): void;
  handle(): void;
  handle(_event?: OrderCreated): void {}
}

@RegisterEventHandler(OrderCreated)
class ZeroThenGenericOrderCreatedHandler implements EventHandler<OrderCreated> {
  handle(): void;
  handle<TEvent extends OrderCreated>(_event: TEvent): void;
  handle(_event?: OrderCreated): void {}
}

// @ts-expect-error A leading zero-argument overload cannot hide a subtype-constrained generic handler.
@RegisterEventHandler(OrderCreated)
class ZeroThenGenericPriorityOrderCreatedHandler implements EventHandler<PriorityOrderCreated> {
  handle(): void;
  handle<TEvent extends PriorityOrderCreated>(_event: TEvent): void;
  handle(_event?: PriorityOrderCreated): void {}
}

// @ts-expect-error A trailing zero-argument overload cannot hide a subtype-constrained generic handler.
@RegisterEventHandler(OrderCreated)
class GenericThenZeroPriorityOrderCreatedHandler implements EventHandler<PriorityOrderCreated> {
  handle<TEvent extends PriorityOrderCreated>(_event: TEvent): void;
  handle(): void;
  handle(_event?: PriorityOrderCreated): void {}
}

describe("RegisterEventHandler", () => {
  it("preserves an explicit handler identity independently of the constructor name", () => {
    class RenamedHandler implements EventHandler<OrderCreated> {
      handle(_event: OrderCreated): void {}
    }

    RegisterEventHandler(OrderCreated, { handlerId: "orders.fulfillment.v1" })(RenamedHandler);

    expect(getEventHandlerSubscriptions(RenamedHandler)).toEqual([
      {
        eventName: "order.created",
        handlerClass: RenamedHandler,
        handlerId: "orders.fulfillment.v1",
      },
    ]);
  });

  it("preserves the event-specific subscription metadata without a handler cast", () => {
    const subscriptions = getEventHandlerSubscriptions(OrderCreatedHandler);
    const handler = new DefaultHandlerResolver().resolve(OrderCreatedHandler);

    expectTypeOf(subscriptions).toEqualTypeOf<EventSubscription<OrderCreated>[]>();
    expectTypeOf(handler).toEqualTypeOf<EventHandler<OrderCreated>>();
    expect(subscriptions).toEqual([
      {
        eventName: "order.created.v2",
        handlerClass: OrderCreatedHandler,
      },
    ]);
  });
});
