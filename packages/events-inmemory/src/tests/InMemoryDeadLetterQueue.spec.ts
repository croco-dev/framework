import {
  DomainEvent,
  EventBusConfig,
  EventBusStats,
  type DeadLetterItem,
  type EventHandler,
  type RetryableEventHandler,
} from "@croco/events-core";
import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
  type TokenIdentifier,
} from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeadLetterQueueNotConfiguredProblem,
  InMemoryDeadLetterQueue,
  InMemoryEventBus,
  InvalidDeadLetterPolicyProblem,
  InvalidDeadLetterQueueLimitProblem,
  InvalidDeadLetterHandlerIdentityProblem,
  InvalidDeadLetterRetryCountProblem,
} from "../index";

class DeadLetterTestEvent extends DomainEvent {
  static readonly eventName = "dead-letter.test";

  constructor(readonly value: string) {
    super();
  }
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function controlledReplay(strategy: "block" | "drop" | "error" = "block") {
  const queue = new InMemoryDeadLetterQueue();
  const started = signal();
  const release = signal();
  const calls: string[] = [];
  let active = 0;
  let maximumActive = 0;
  class ControlledHandler implements EventHandler<DeadLetterTestEvent> {
    async handle(event: DeadLetterTestEvent): Promise<void> {
      calls.push(event.value);
      active++;
      maximumActive = Math.max(maximumActive, active);
      try {
        if (calls.length === 1) {
          started.resolve();
          await release.promise;
        }
      } finally {
        active--;
      }
    }
  }
  const bus = new InMemoryEventBus<DeadLetterTestEvent>({
    deadLetterQueue: queue,
    deadLetterPolicy: { maxRetries: 0 },
    maxConcurrency: 1,
    backpressureStrategy: strategy,
    backpressureTimeoutMs: 25,
  });
  Container.set(ControlledHandler, new ControlledHandler());
  bus.subscribe({
    eventName: DeadLetterTestEvent.eventName,
    handlerClass: ControlledHandler,
    handlerId: "ControlledHandler",
  });
  const enqueue = (value: string) =>
    queue.enqueue({
      event: new DeadLetterTestEvent(value),
      handlerId: ControlledHandler.name,
      failedAt: new Date(),
      reason: "handler-retries-exhausted",
      retryCount: 0,
    });
  return { queue, bus, started, release, calls, enqueue, maximumActive: () => maximumActive };
}

describe("InMemoryDeadLetterQueue", () => {
  it("deduplicates the same event and handler while preserving stable item identity", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const event = new DeadLetterTestEvent("original");
    const baseItem = {
      event,
      reason: "handler-retries-exhausted",
      failedAt: new Date(Date.now() - 60_000),
      retryCount: 2,
      handlerId: "FailingHandler",
    };

    await queue.enqueue(baseItem);
    await queue.enqueue({
      ...baseItem,
      failedAt: new Date(),
      retryCount: 3,
    });

    const items = await queue.peek<DeadLetterTestEvent>();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      event: { eventId: event.eventId, value: "original" },
      handlerId: "FailingHandler",
      retryCount: 3,
    });
    expect(items[0]?.itemId).toBeTruthy();
  });

  it("atomically removes dequeued items so concurrent consumers do not replay duplicates", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const event = new DeadLetterTestEvent("concurrent");
    await queue.enqueue({
      event,
      reason: "handler-retries-exhausted",
      failedAt: new Date(),
      retryCount: 1,
      handlerId: "FailingHandler",
    });

    const [first, second] = await Promise.all([queue.dequeue(1), queue.dequeue(1)]);

    expect([...first, ...second]).toHaveLength(1);
    await expect(queue.size()).resolves.toBe(0);
  });

  it("returns defensive copies and removes entries by item or event identity", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const event = new DeadLetterTestEvent("immutable");
    await queue.enqueue({
      event,
      reason: "handler-retries-exhausted",
      failedAt: new Date(),
      retryCount: 1,
      handlerId: "FirstHandler",
    });
    await queue.enqueue({
      event,
      reason: "handler-retries-exhausted",
      failedAt: new Date(),
      retryCount: 1,
      handlerId: "SecondHandler",
    });

    const firstSnapshot = await queue.peek<DeadLetterTestEvent>();
    const firstItem = firstSnapshot[0];
    if (!firstItem) {
      throw new Error("Expected a dead-letter item");
    }
    firstItem.event.metadata.changed = true;
    await queue.remove(firstItem.itemId);

    const secondSnapshot = await queue.peek<DeadLetterTestEvent>();
    expect(secondSnapshot).toHaveLength(1);
    expect(secondSnapshot[0]?.event.metadata).toEqual({});

    await queue.remove(event.eventId);
    await expect(queue.size()).resolves.toBe(0);
  });

  it("expires entries using their bounded retention metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00.000Z"));
    try {
      const queue = new InMemoryDeadLetterQueue();
      await queue.enqueue({
        event: new DeadLetterTestEvent("retention"),
        reason: "handler-retries-exhausted",
        failedAt: new Date(),
        retryCount: 1,
        handlerId: "FailingHandler",
        metadata: { retentionDays: 1 },
      });

      vi.setSystemTime(new Date("2026-09-04T00:00:00.000Z"));

      await expect(queue.size()).resolves.toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an invalid dequeue batch before changing queue state", async () => {
    const queue = new InMemoryDeadLetterQueue();
    await queue.enqueue({
      event: new DeadLetterTestEvent("limit"),
      reason: "handler-retries-exhausted",
      failedAt: new Date(),
      retryCount: 1,
      handlerId: "FailingHandler",
    });

    await expect(queue.dequeue(0)).rejects.toBeInstanceOf(InvalidDeadLetterQueueLimitProblem);
    await expect(queue.size()).resolves.toBe(1);
  });
});

describe("InMemoryEventBus dead-letter execution", () => {
  beforeEach(() => {
    Container.reset();
    EventBusConfig.setStats(new EventBusStats());
  });

  it("stores initial provider resolution failure with original identity and safe dead-letter metadata", async () => {
    class UnavailableProviderHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    const queue = new InMemoryDeadLetterQueue();
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: queue,
      deadLetterPolicy: { maxRetries: 0, retentionDays: 2 },
    });
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: UnavailableProviderHandler,
      handlerId: "UnavailableProviderHandler",
    });
    const event = new DeadLetterTestEvent("original-payload");
    const resolutionError = new Error("credential=provider-secret");
    resolutionError.name = "ProviderResolutionError";
    const originalGet = Container.get.bind(Container);
    const get = vi.spyOn(Container, "get").mockImplementation(<T>(token: TokenIdentifier<T>): T => {
      if (token === UnavailableProviderHandler) {
        throw resolutionError;
      }
      return originalGet(token);
    });

    try {
      await expect(bus.publish(event)).rejects.toMatchObject({
        failures: [{ handlerName: UnavailableProviderHandler.name, error: resolutionError }],
      });

      const items = await queue.peek<DeadLetterTestEvent>();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        event: { eventId: event.eventId, eventName: event.eventName, value: "original-payload" },
        handlerId: UnavailableProviderHandler.name,
        reason: "handler-resolution-failed",
        retryCount: 0,
        lastError: "ProviderResolutionError",
        metadata: { errorName: "ProviderResolutionError", retentionDays: 2 },
      });
      const item = items[0];
      if (!item) {
        throw new Error("Expected provider resolution dead letter");
      }
      const { event: _event, ...evidence } = item;
      expect(JSON.stringify(evidence)).not.toContain("provider-secret");
      expect(JSON.stringify(evidence)).not.toContain("original-payload");
      expect(bus.getRunningHandlerCount()).toBe(0);
    } finally {
      get.mockRestore();
    }
  });

  it("replays a provider resolution dead letter through tracked execution after provider recovery", async () => {
    const started = signal();
    const release = signal();
    const received: DeadLetterTestEvent[] = [];
    class RecoverableProviderHandler implements EventHandler<DeadLetterTestEvent> {
      async handle(event: DeadLetterTestEvent): Promise<void> {
        received.push(event);
        started.resolve();
        await release.promise;
      }
    }
    const queue = new InMemoryDeadLetterQueue();
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: queue,
      deadLetterPolicy: { maxRetries: 0 },
    });
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: RecoverableProviderHandler,
      handlerId: "RecoverableProviderHandler",
    });
    const originalGet = Container.get.bind(Container);
    const get = vi.spyOn(Container, "get").mockImplementation(<T>(token: TokenIdentifier<T>): T => {
      if (token === RecoverableProviderHandler) {
        throw new Error("provider unavailable");
      }
      return originalGet(token);
    });
    const event = new DeadLetterTestEvent("recovered");
    try {
      await expect(bus.publish(event)).rejects.toBeDefined();
      await expect(queue.size()).resolves.toBe(1);
    } finally {
      get.mockRestore();
    }
    Container.set(RecoverableProviderHandler, new RecoverableProviderHandler());
    const replay = bus.replayDeadLetters();
    try {
      await Promise.race([
        started.promise,
        replay.then(() => {
          throw new Error("Expected recovered provider handler to start before replay completes");
        }),
      ]);
      expect(bus.getRunningHandlerCount()).toBe(1);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ eventId: event.eventId, value: "recovered" });
      release.resolve();
      await expect(replay).resolves.toEqual({
        attempted: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      });
      await expect(queue.size()).resolves.toBe(0);
      expect(bus.getRunningHandlerCount()).toBe(0);
    } finally {
      release.resolve();
      await replay;
    }
  });

  it("preserves initial provider resolution failure when no dead-letter queue is configured", async () => {
    class UnavailableLegacyHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    const bus = new InMemoryEventBus<DeadLetterTestEvent>();
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: UnavailableLegacyHandler,
    });
    const resolutionError = new Error("provider unavailable");
    const originalGet = Container.get.bind(Container);
    const get = vi.spyOn(Container, "get").mockImplementation(<T>(token: TokenIdentifier<T>): T => {
      if (token === UnavailableLegacyHandler) {
        throw resolutionError;
      }
      return originalGet(token);
    });
    try {
      await expect(bus.publish(new DeadLetterTestEvent("legacy"))).rejects.toMatchObject({
        failures: [{ handlerName: UnavailableLegacyHandler.name, error: resolutionError }],
      });
      expect(get.mock.calls.filter(([token]) => token === UnavailableLegacyHandler)).toHaveLength(
        1,
      );
      expect(bus.getRunningHandlerCount()).toBe(0);
    } finally {
      get.mockRestore();
    }
  });

  it.each(["error", "drop"] as const)(
    "requeues replay without invoking its handler when an active publish exhausts %s capacity",
    async (strategy) => {
      const fixture = controlledReplay(strategy);
      await fixture.enqueue("replay");
      const publishing = fixture.bus.publish(new DeadLetterTestEvent("publish"));
      await fixture.started.promise;
      try {
        const result = await fixture.bus.replayDeadLetters();
        expect(result).toMatchObject({ attempted: 1, succeeded: 0, failed: 1 });
        expect(result.failures[0]).toMatchObject({ requeued: true });
        expect(fixture.calls).toEqual(["publish"]);
        await expect(fixture.queue.size()).resolves.toBe(1);
      } finally {
        fixture.release.resolve();
        await publishing;
      }
    },
  );

  it("waits for an active publish to release its slot before replaying", async () => {
    vi.useFakeTimers();
    const fixture = controlledReplay();
    await fixture.enqueue("replay");
    const publishing = fixture.bus.publish(new DeadLetterTestEvent("publish"));
    await fixture.started.promise;
    const replaying = fixture.bus.replayDeadLetters();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(fixture.calls).toEqual(["publish"]);
      fixture.release.resolve();
      await publishing;
      await expect(replaying).resolves.toMatchObject({ succeeded: 1, failed: 0 });
      expect(fixture.calls).toEqual(["publish", "replay"]);
      expect(fixture.maximumActive()).toBe(1);
    } finally {
      fixture.release.resolve();
      await Promise.all([publishing, replaying]);
      vi.useRealTimers();
    }
  });

  it("requeues a blocked replay when its admission deadline expires", async () => {
    vi.useFakeTimers();
    const fixture = controlledReplay();
    await fixture.enqueue("replay");
    const publishing = fixture.bus.publish(new DeadLetterTestEvent("publish"));
    await fixture.started.promise;
    const replaying = fixture.bus.replayDeadLetters();
    try {
      await vi.advanceTimersByTimeAsync(25);
      const result = await replaying;
      expect(result.failures[0]).toMatchObject({
        requeued: true,
        error: { code: "events-inmemory/backpressure-timeout" },
      });
      expect(fixture.calls).toEqual(["publish"]);
      await expect(fixture.queue.size()).resolves.toBe(1);
    } finally {
      fixture.release.resolve();
      await Promise.all([publishing, replaying]);
      vi.useRealTimers();
    }
  });

  it("shares one concurrency slot between simultaneous replay calls", async () => {
    vi.useFakeTimers();
    const fixture = controlledReplay();
    await fixture.enqueue("first");
    await fixture.enqueue("second");
    const first = fixture.bus.replayDeadLetters(1);
    const second = fixture.bus.replayDeadLetters(1);
    try {
      await fixture.started.promise;
      await vi.advanceTimersByTimeAsync(0);
      expect(fixture.calls).toEqual(["first"]);
      fixture.release.resolve();
      const results = await Promise.all([first, second]);
      expect(results.map((result) => result.succeeded)).toEqual([1, 1]);
      expect(fixture.maximumActive()).toBe(1);
      expect(fixture.calls).toEqual(["first", "second"]);
    } finally {
      fixture.release.resolve();
      await Promise.all([first, second]);
      vi.useRealTimers();
    }
  });

  it("continues the claimed batch after storage fails for an unavailable handler", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const missing: DeadLetterItem<DeadLetterTestEvent> = {
      event: new DeadLetterTestEvent("recoverable-payload"),
      handlerId: "MissingHandler",
      failedAt: new Date(),
      reason: "handler-retries-exhausted",
      retryCount: 2,
    };
    const handle = vi.fn();
    class AvailableHandler implements EventHandler<DeadLetterTestEvent> {
      handle = handle;
    }
    await queue.enqueue(missing);
    await queue.enqueue({
      ...missing,
      event: new DeadLetterTestEvent("second"),
      handlerId: AvailableHandler.name,
    });
    const storageError = new Error("storage unavailable");
    const enqueue = vi.spyOn(queue, "enqueue").mockRejectedValue(storageError);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    Container.set(AvailableHandler, new AvailableHandler());
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: AvailableHandler,
      handlerId: "AvailableHandler",
    });

    const result = await bus.replayDeadLetters();

    expect(result).toMatchObject({ attempted: 2, succeeded: 1, failed: 1 });
    expect(handle).toHaveBeenCalledOnce();
    expect(result.failures[0]).toMatchObject({
      item: missing,
      requeued: false,
      error: { code: "events-inmemory/dead-letter-handler-unavailable" },
    });
    expect(result.failures[0]?.storageError).toBe(storageError);
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("returns the updated exhausted item after a single failed storage write", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const handlerError = new Error("handler failure");
    const handle = vi.fn(() => {
      throw handlerError;
    });
    class FailingHandler implements EventHandler<DeadLetterTestEvent> {
      handle = handle;
    }
    const original = {
      event: new DeadLetterTestEvent("recoverable-payload"),
      handlerId: FailingHandler.name,
      failedAt: new Date(Date.now() - 1_000),
      reason: "handler-retries-exhausted",
      retryCount: 4,
    };
    await queue.enqueue(original);
    const storageError = new Error("storage unavailable");
    const enqueue = vi.spyOn(queue, "enqueue").mockRejectedValueOnce(storageError);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: queue,
      deadLetterPolicy: { maxRetries: 1, retryDelayMs: 0 },
    });
    Container.set(FailingHandler, new FailingHandler());
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: FailingHandler,
      handlerId: "FailingHandler",
    });

    const result = await bus.replayDeadLetters();

    expect(handle).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(result.failures[0]).toMatchObject({
      item: { event: original.event, handlerId: FailingHandler.name, retryCount: 6 },
      requeued: false,
    });
    expect(result.failures[0]?.item).toEqual(enqueue.mock.calls[0]?.[0]);
    expect(result.failures[0]?.error).toBe(handlerError);
    expect(result.failures[0]?.storageError).toBe(storageError);
    await expect(queue.size()).resolves.toBe(0);
  });

  it("rejects dead-letter policy without storage and invalid bounded values", async () => {
    expect(() => new InMemoryEventBus({ deadLetterPolicy: { maxRetries: 1 } })).toThrow(
      DeadLetterQueueNotConfiguredProblem,
    );
    expect(
      () =>
        new InMemoryEventBus({
          deadLetterQueue: new InMemoryDeadLetterQueue(),
          deadLetterPolicy: { maxRetries: -1 },
        }),
    ).toThrow(InvalidDeadLetterPolicyProblem);

    const eventBus = new InMemoryEventBus();
    await expect(eventBus.replayDeadLetters()).rejects.toBeInstanceOf(
      DeadLetterQueueNotConfiguredProblem,
    );
  });

  it("replays across renamed handler builds using the same explicit stable handler ID", async () => {
    const queue = new InMemoryDeadLetterQueue();
    class OriginalHandler implements EventHandler<DeadLetterTestEvent> {
      handle(): void {
        throw new Error("old deployment unavailable");
      }
    }
    class RenamedHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    const oldBus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: queue,
      deadLetterPolicy: { maxRetries: 0 },
    });
    Container.set(OriginalHandler, new OriginalHandler());
    oldBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: OriginalHandler,
      handlerId: "orders.projector.v1",
    });
    const event = new DeadLetterTestEvent("survives-build-rename");
    await expect(oldBus.publish(event)).rejects.toBeDefined();
    expect((await queue.peek())[0]?.handlerId).toBe("orders.projector.v1");
    const recovered = new RenamedHandler();
    Container.set(RenamedHandler, recovered);
    const newBus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    newBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: RenamedHandler,
      handlerId: "orders.projector.v1",
    });

    await expect(newBus.replayDeadLetters()).resolves.toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      failures: [],
    });

    expect(recovered.handle).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ eventId: event.eventId }),
    );
    await expect(queue.size()).resolves.toBe(0);
  });

  it("rejects inconsistent stable handler IDs for the same class across subscriptions", async () => {
    class SharedHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    const handler = new SharedHandler();
    Container.set(SharedHandler, handler);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: new InMemoryDeadLetterQueue(),
    });
    bus.subscribe({
      eventName: "another.event",
      handlerClass: SharedHandler,
      handlerId: "original-id",
    });

    expect(() =>
      bus.subscribe({
        eventName: DeadLetterTestEvent.eventName,
        handlerClass: SharedHandler,
        handlerId: "different-id",
      }),
    ).toThrow(InvalidDeadLetterHandlerIdentityProblem);
    await bus.publish(new DeadLetterTestEvent("not-registered"));
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it("delivers to same-name constructors with distinct explicit stable handler IDs", async () => {
    const First = class SharedName implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    };
    const Second = class SharedName implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    };
    const first = new First();
    const second = new Second();
    Container.set(First, first);
    Container.set(Second, second);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: new InMemoryDeadLetterQueue(),
    });
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: First,
      handlerId: "first",
    });
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: Second,
      handlerId: "second",
    });

    await bus.publish(new DeadLetterTestEvent("separate-identities"));

    expect(first.handle).toHaveBeenCalledOnce();
    expect(second.handle).toHaveBeenCalledOnce();
  });

  it("accepts an unnamed handler constructor when its stable handler ID is explicit", async () => {
    class UnnamedHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    Object.defineProperty(UnnamedHandler, "name", { value: "" });
    const handler = new UnnamedHandler();
    Container.set(UnnamedHandler, handler);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: new InMemoryDeadLetterQueue(),
    });
    bus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: UnnamedHandler,
      handlerId: "explicit-id",
    });

    await bus.publish(new DeadLetterTestEvent("named-by-contract"));

    expect(handler.handle).toHaveBeenCalledOnce();
  });

  it("rejects a duplicate stable handler ID across event subscriptions before registering it", async () => {
    const firstHandle = vi.fn();
    const secondHandle = vi.fn();
    const First = class FirstHandler implements EventHandler<DeadLetterTestEvent> {
      handle = firstHandle;
    };
    const Second = class SecondHandler implements EventHandler<DeadLetterTestEvent> {
      handle = secondHandle;
    };
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: new InMemoryDeadLetterQueue(),
    });
    Container.set(First, new First());
    Container.set(Second, new Second());
    bus.subscribe({ eventName: "another.event", handlerClass: First, handlerId: "shared-id" });

    expect(() =>
      bus.subscribe({
        eventName: DeadLetterTestEvent.eventName,
        handlerClass: Second,
        handlerId: "shared-id",
      }),
    ).toThrow(InvalidDeadLetterHandlerIdentityProblem);
    await bus.publish(new DeadLetterTestEvent("not-registered"));
    expect(secondHandle).not.toHaveBeenCalled();
  });

  it.each(["unsubscribe", "clear"] as const)(
    "reserves a stable handler ID after %s while allowing the original class to resubscribe",
    (operation) => {
      const First = class SharedName implements EventHandler<DeadLetterTestEvent> {
        handle = vi.fn();
      };
      const Second = class SharedName implements EventHandler<DeadLetterTestEvent> {
        handle = vi.fn();
      };
      const bus = new InMemoryEventBus<DeadLetterTestEvent>({
        deadLetterQueue: new InMemoryDeadLetterQueue(),
      });
      const subscription = {
        eventName: DeadLetterTestEvent.eventName,
        handlerClass: First,
        handlerId: "shared-id",
      };
      bus.subscribe(subscription);
      if (operation === "clear") {
        bus.clear();
      } else {
        bus.unsubscribe(subscription);
      }

      expect(() => bus.subscribe({ ...subscription, handlerClass: Second })).toThrow(
        InvalidDeadLetterHandlerIdentityProblem,
      );
      expect(() => bus.subscribe(subscription)).not.toThrow();
    },
  );

  it.each([undefined, "", "   "])(
    "rejects missing or empty stable handler ID %j before registering it",
    async (handlerId) => {
      class UnnamedHandler implements EventHandler<DeadLetterTestEvent> {
        handle = vi.fn();
      }
      const handler = new UnnamedHandler();
      const bus = new InMemoryEventBus<DeadLetterTestEvent>({
        deadLetterQueue: new InMemoryDeadLetterQueue(),
      });
      Container.set(UnnamedHandler, handler);

      expect(() =>
        bus.subscribe({
          eventName: DeadLetterTestEvent.eventName,
          handlerClass: UnnamedHandler,
          handlerId,
        }),
      ).toThrow(InvalidDeadLetterHandlerIdentityProblem);
      await bus.publish(new DeadLetterTestEvent("not-registered"));
      expect(handler.handle).not.toHaveBeenCalled();
    },
  );

  it("allows the same handler class in repeated exact and wildcard subscriptions", async () => {
    class SharedHandler implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    }
    const handler = new SharedHandler();
    const bus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: new InMemoryDeadLetterQueue(),
    });
    Container.set(SharedHandler, handler);
    const subscription = {
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: SharedHandler,
      handlerId: "shared-handler",
    };
    bus.subscribe(subscription);
    bus.subscribe(subscription);
    bus.subscribe({
      eventName: "dead-letter.*",
      handlerClass: SharedHandler,
      handlerId: "shared-handler",
    });

    await bus.publish(new DeadLetterTestEvent("deduplicated"));

    expect(handler.handle).toHaveBeenCalledOnce();
  });

  it("preserves same-name constructor subscriptions when no dead-letter queue is configured", async () => {
    const First = class SharedName implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    };
    const Second = class SharedName implements EventHandler<DeadLetterTestEvent> {
      handle = vi.fn();
    };
    const first = new First();
    const second = new Second();
    Container.set(First, first);
    Container.set(Second, second);
    const bus = new InMemoryEventBus<DeadLetterTestEvent>();
    bus.subscribe({ eventName: DeadLetterTestEvent.eventName, handlerClass: First });
    bus.subscribe({ eventName: DeadLetterTestEvent.eventName, handlerClass: Second });

    await bus.publish(new DeadLetterTestEvent("legacy"));

    expect(first.handle).toHaveBeenCalledOnce();
    expect(second.handle).toHaveBeenCalledOnce();
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER])(
    "rejects an unsafe cumulative retry budget from prior count %s before invoking the handler",
    async (retryCount) => {
      const queue = new InMemoryDeadLetterQueue();
      class CountedHandler implements EventHandler<DeadLetterTestEvent> {
        handle = vi.fn();
      }
      const handler = new CountedHandler();
      Container.set(CountedHandler, handler);
      const bus = new InMemoryEventBus<DeadLetterTestEvent>({
        deadLetterQueue: queue,
        deadLetterPolicy: { maxRetries: 0 },
      });
      bus.subscribe({
        eventName: DeadLetterTestEvent.eventName,
        handlerClass: CountedHandler,
        handlerId: "CountedHandler",
      });
      await queue.enqueue({
        event: new DeadLetterTestEvent("invalid-count"),
        handlerId: CountedHandler.name,
        failedAt: new Date(),
        reason: "handler-retries-exhausted",
        retryCount,
      });

      const result = await bus.replayDeadLetters();

      expect(result.failures[0]?.error).toBeInstanceOf(InvalidDeadLetterRetryCountProblem);
      expect(result.failures[0]).toMatchObject({ requeued: true, item: { retryCount } });
      expect(handler.handle).not.toHaveBeenCalled();
      await expect(queue.size()).resolves.toBe(1);
    },
  );

  it("retries exhausted handlers and records safe dead-letter evidence", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const inspector = new RuntimeInspector();
    inspector.startRequest({ requestId: "dead-letter-request" });
    Container.set(DEV_INSPECTOR_TOKEN, inspector);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class FailingHandler implements EventHandler<DeadLetterTestEvent>, RetryableEventHandler {
      attempts = 0;
      exhausted = 0;

      handle(event: DeadLetterTestEvent): void {
        this.attempts++;
        throw new Error(`credential=${event.value}`);
      }

      getRetryPolicy() {
        return { maxRetries: 2, retryDelayMs: 0 };
      }

      async onExhaustedRetries(): Promise<void> {
        this.exhausted++;
      }
    }

    const handler = new FailingHandler();
    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    Container.set(FailingHandler, handler);
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: FailingHandler,
      handlerId: "FailingHandler",
    });

    const event = new DeadLetterTestEvent("payload-secret");
    await expect(
      Context.run({ requestId: "dead-letter-request" }, () => eventBus.publish(event)),
    ).rejects.toMatchObject({ eventName: DeadLetterTestEvent.eventName });
    inspector.finishRequest({
      requestId: "dead-letter-request",
      status: 500,
      outcome: "failed",
    });

    expect(handler.attempts).toBe(3);
    expect(handler.exhausted).toBe(1);
    const items = await queue.peek<DeadLetterTestEvent>();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      event: { eventId: event.eventId, eventName: DeadLetterTestEvent.eventName },
      reason: "handler-retries-exhausted",
      retryCount: 2,
      lastError: "Error",
      handlerId: "FailingHandler",
      metadata: {
        errorName: "Error",
        retentionDays: 7,
      },
    });

    const timeline = inspector.snapshot().requests[0]?.timeline ?? [];
    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "retry.exhausted", outcome: "failed" }),
        expect.objectContaining({ kind: "event.dead-letter", outcome: "succeeded" }),
      ]),
    );
    expect(JSON.stringify(timeline)).not.toContain("payload-secret");
    expect(JSON.stringify(timeline)).not.toContain("credential=");
    consoleErrorSpy.mockRestore();
  });

  it("replays only the failed handler with the original event identity and consumes it once", async () => {
    const queue = new InMemoryDeadLetterQueue();
    let shouldFail = true;

    class RecoveringHandler implements EventHandler<DeadLetterTestEvent>, RetryableEventHandler {
      readonly eventIds: string[] = [];

      handle(event: DeadLetterTestEvent): void {
        this.eventIds.push(event.eventId);
        if (shouldFail) {
          throw new Error("temporarily unavailable");
        }
      }

      getRetryPolicy() {
        return { maxRetries: 0, retryDelayMs: 0 };
      }
    }

    class SuccessfulPeerHandler implements EventHandler<DeadLetterTestEvent> {
      calls = 0;

      handle(): void {
        this.calls++;
      }
    }

    const recovering = new RecoveringHandler();
    const peer = new SuccessfulPeerHandler();
    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    Container.set(RecoveringHandler, recovering);
    Container.set(SuccessfulPeerHandler, peer);
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: RecoveringHandler,
      handlerId: "RecoveringHandler",
    });
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: SuccessfulPeerHandler,
      handlerId: "SuccessfulPeerHandler",
    });

    const event = new DeadLetterTestEvent("replay");
    await expect(eventBus.publish(event)).rejects.toMatchObject({
      eventName: DeadLetterTestEvent.eventName,
    });
    expect(peer.calls).toBe(1);

    shouldFail = false;
    await expect(eventBus.replayDeadLetters()).resolves.toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      failures: [],
    });
    await expect(eventBus.replayDeadLetters()).resolves.toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    });

    expect(recovering.eventIds).toEqual([event.eventId, event.eventId]);
    expect(peer.calls).toBe(1);
    await expect(queue.size()).resolves.toBe(0);
  });

  it("requeues a failed replay with cumulative bounded retry metadata", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class AlwaysFailingHandler implements EventHandler<DeadLetterTestEvent>, RetryableEventHandler {
      attempts = 0;
      exhausted = 0;

      handle(): void {
        this.attempts++;
        throw new Error("unavailable");
      }

      getRetryPolicy() {
        return { maxRetries: 1, retryDelayMs: 0 };
      }

      async onExhaustedRetries(): Promise<void> {
        this.exhausted++;
      }
    }

    const handler = new AlwaysFailingHandler();
    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    Container.set(AlwaysFailingHandler, handler);
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: AlwaysFailingHandler,
      handlerId: "AlwaysFailingHandler",
    });

    await expect(eventBus.publish(new DeadLetterTestEvent("failure"))).rejects.toBeDefined();
    const replay = await eventBus.replayDeadLetters();

    expect(replay).toMatchObject({ attempted: 1, succeeded: 0, failed: 1 });
    expect(replay.failures).toHaveLength(1);
    expect(handler.attempts).toBe(4);
    expect(handler.exhausted).toBe(2);
    const [item] = await queue.peek<DeadLetterTestEvent>();
    expect(item?.retryCount).toBe(3);
    consoleErrorSpy.mockRestore();
  });

  it("applies the configured bus policy without requiring a handler override", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class PlainFailingHandler implements EventHandler<DeadLetterTestEvent> {
      attempts = 0;

      handle(): void {
        this.attempts++;
        throw new Error("failure");
      }
    }

    const handler = new PlainFailingHandler();
    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>({
      deadLetterQueue: queue,
      deadLetterPolicy: { maxRetries: 1, retryDelayMs: 0 },
    });
    Container.set(PlainFailingHandler, handler);
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: PlainFailingHandler,
      handlerId: "PlainFailingHandler",
    });

    await expect(eventBus.publish(new DeadLetterTestEvent("plain"))).rejects.toBeDefined();

    expect(handler.attempts).toBe(2);
    await expect(queue.size()).resolves.toBe(1);
    consoleErrorSpy.mockRestore();
  });

  it("keeps a dead letter when its recorded handler is no longer subscribed", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class RemovedHandler implements EventHandler<DeadLetterTestEvent>, RetryableEventHandler {
      handle(): void {
        throw new Error("failure");
      }

      getRetryPolicy() {
        return { maxRetries: 0, retryDelayMs: 0 };
      }
    }

    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>({ deadLetterQueue: queue });
    Container.set(RemovedHandler, new RemovedHandler());
    const subscription = {
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: RemovedHandler,
      handlerId: "RemovedHandler",
    };
    eventBus.subscribe(subscription);
    await expect(eventBus.publish(new DeadLetterTestEvent("removed"))).rejects.toBeDefined();
    eventBus.unsubscribe(subscription);

    const replay = await eventBus.replayDeadLetters();

    expect(replay).toMatchObject({ attempted: 1, succeeded: 0, failed: 1 });
    expect(replay.failures[0]?.error).toMatchObject({
      code: "events-inmemory/dead-letter-handler-unavailable",
    });
    await expect(queue.size()).resolves.toBe(1);
    consoleErrorSpy.mockRestore();
  });

  it("does not retry handlers when no dead-letter queue is configured", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class RetryableFailingHandler
      implements EventHandler<DeadLetterTestEvent>, RetryableEventHandler
    {
      attempts = 0;

      handle(): void {
        this.attempts++;
        throw new Error("failure");
      }

      getRetryPolicy() {
        return { maxRetries: 3, retryDelayMs: 0 };
      }
    }

    const handler = new RetryableFailingHandler();
    const eventBus = new InMemoryEventBus<DeadLetterTestEvent>();
    Container.set(RetryableFailingHandler, handler);
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: RetryableFailingHandler,
    });

    await expect(eventBus.publish(new DeadLetterTestEvent("legacy"))).rejects.toBeDefined();

    expect(handler.attempts).toBe(1);
    consoleErrorSpy.mockRestore();
  });
});
