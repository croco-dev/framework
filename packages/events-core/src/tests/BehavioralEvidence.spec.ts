import { describe, expect, it } from "vitest";
import { DomainEvent, DuplicateEventNameProblem, EventRegistry } from "../index";

class OrderCreated extends DomainEvent {
  static eventName = "order.created";
}

class DuplicateOrderCreated extends DomainEvent {
  static eventName = "order.created";
}

describe("events-core behavioral evidence", () => {
  it("registers and resolves a public domain event by its stable event name", () => {
    const registry = new EventRegistry().register(OrderCreated);

    expect(registry.get("order.created")).toBe(OrderCreated);
    expect(new OrderCreated().eventName).toBe("order.created");
  });

  it("rejects duplicate public event names with a typed Problem", () => {
    const registry = new EventRegistry().register(OrderCreated);

    expect(() => registry.register(DuplicateOrderCreated)).toThrow(DuplicateEventNameProblem);
  });
});
