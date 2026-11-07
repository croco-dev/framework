import { DomainEvent } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryDeadLetterQueue,
  InMemoryEventBus,
  UnsupportedDeadLetterValueProblem,
} from "../index";

class PayloadEvent<T = unknown> extends DomainEvent {
  static readonly eventName = "payload-isolation";

  constructor(public payload: T) {
    super();
  }
}

class PayloadHandler {
  handle(): void {}
}

class ObservingHandler extends PayloadHandler {}

describe.each([false, true])("InMemoryEventBus payloads with DLQ=%s", (withDlq) => {
  beforeEach(() => {
    Container.reset();
  });

  function createBus<T>() {
    return new InMemoryEventBus<PayloadEvent<T>>({
      maxConcurrency: 1,
      ...(withDlq ? { deadLetterQueue: new InMemoryDeadLetterQueue() } : {}),
    });
  }

  it("isolates collection mutations from the publisher and the next handler", async () => {
    const shared = { count: 7 };
    const key = { name: "original" };
    const payload = {
      map: new Map([[key, shared]]),
      set: new Set([shared]),
      nested: [[shared]],
    };
    const event = new PayloadEvent(payload);
    const bus = createBus<typeof payload>();
    const received: (typeof event)[] = [];
    bus.subscribe({
      eventName: PayloadEvent.eventName,
      handlerClass: PayloadHandler,
      handlerId: "mutating.v1",
      handler: {
        handle(copy) {
          received.push(copy);
          for (const [copiedKey, value] of copy.payload.map) {
            copiedKey.name = "changed";
            value.count = 99;
          }
          copy.payload.map.clear();
          copy.payload.set.clear();
          copy.payload.nested.push([{ count: 123 }]);
        },
      },
    });
    bus.subscribe({
      eventName: PayloadEvent.eventName,
      handlerClass: ObservingHandler,
      handlerId: "observing.v1",
      handler: {
        handle: (copy) => {
          received.push(copy);
        },
      },
    });

    await bus.publish(event);

    expect(received).toHaveLength(2);
    const [mutated, observed] = received;
    assert.isDefined(observed);
    expect(mutated?.payload.nested).toEqual([[{ count: 99 }], [{ count: 123 }]]);
    expect(observed).toBeInstanceOf(PayloadEvent);
    expect(observed?.eventId).toBe(event.eventId);
    expect(observed?.timestamp).toEqual(event.timestamp);
    expect(observed?.timestamp).not.toBe(event.timestamp);
    expect(observed?.payload.map).toEqual(new Map([[{ name: "original" }, { count: 7 }]]));
    expect(observed?.payload.set).toEqual(new Set([{ count: 7 }]));
    expect(observed?.payload.nested).toEqual([[{ count: 7 }]]);
    expect([...observed.payload.map.values()][0]).toBe(observed.payload.nested[0][0]);
    expect([...observed.payload.set][0]).toBe(observed.payload.nested[0][0]);
    expect(payload.map.get(key)).toBe(shared);
    expect(key.name).toBe("original");
    expect(shared.count).toBe(7);
    expect(payload.set).toEqual(new Set([shared]));
    expect(payload.nested).toEqual([[shared]]);
    expect(event.metadata).toEqual({});
  });

  it("preserves cycles and aliases through trace injection and handler delivery", async () => {
    const event = new PayloadEvent<Record<string | symbol, unknown>>({});
    const symbolKey = Symbol("alias");
    event.payload = event.metadata;
    event.metadata.self = event.metadata;
    event.metadata.owner = event;
    event.payload[symbolKey] = event.metadata;
    event.metadata.collection = new Map([[event, event.metadata]]);
    const handle = vi.fn<(copy: typeof event) => void>();
    const bus = createBus<typeof event.payload>();
    bus.subscribe({
      eventName: PayloadEvent.eventName,
      handlerClass: PayloadHandler,
      handlerId: "cycles.v1",
      handler: { handle },
    });

    await bus.publish(event);

    expect(handle).toHaveBeenCalledOnce();
    const copy = handle.mock.calls[0][0];
    expect(copy).not.toBe(event);
    expect(copy.payload).toBe(copy.metadata);
    expect(copy.metadata.self).toBe(copy.metadata);
    expect(copy.metadata.owner).toBe(copy);
    expect(copy.payload[symbolKey]).toBe(copy.metadata);
    expect((copy.metadata.collection as Map<unknown, unknown>).get(copy)).toBe(copy.metadata);
    expect(copy.metadata.traceContext).toBeDefined();
    expect(event.metadata.traceContext).toBeUndefined();
  });

  it.each([
    ["custom instance", new (class CustomPayload {})()],
    ["function", () => 1],
    ["symbol", Symbol("unsupported")],
    ["binary view", new Uint8Array([1, 2])],
  ])("rejects unsupported %s before invoking a handler", async (_name, value) => {
    const handle = vi.fn();
    const bus = createBus<unknown>();
    bus.subscribe({
      eventName: PayloadEvent.eventName,
      handlerClass: PayloadHandler,
      handlerId: "unsupported.v1",
      handler: { handle },
    });

    await expect(bus.publish(new PayloadEvent({ nested: [value] }))).rejects.toBeInstanceOf(
      UnsupportedDeadLetterValueProblem,
    );
    expect(handle).not.toHaveBeenCalled();
    expect(bus.getRunningHandlerCount()).toBe(0);
  });
});
