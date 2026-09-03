import {
  DomainEvent,
  EventBusConfig,
  EventBusStats,
  type EventHandler,
  type RetryableEventHandler,
} from "@croco/events-core";
import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
} from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeadLetterQueueNotConfiguredProblem,
  InMemoryDeadLetterQueue,
  InMemoryEventBus,
  InvalidDeadLetterPolicyProblem,
  InvalidDeadLetterQueueLimitProblem,
} from "../index";

class DeadLetterTestEvent extends DomainEvent {
  static readonly eventName = "dead-letter.test";

  constructor(readonly value: string) {
    super();
  }
}

describe("InMemoryDeadLetterQueue", () => {
  it("deduplicates the same event and handler while preserving stable item identity", async () => {
    const queue = new InMemoryDeadLetterQueue();
    const event = new DeadLetterTestEvent("original");
    const baseItem = {
      event,
      reason: "handler-retries-exhausted",
      failedAt: new Date("2026-09-03T00:00:00.000Z"),
      retryCount: 2,
      handlerId: "FailingHandler",
    };

    await queue.enqueue(baseItem);
    await queue.enqueue({
      ...baseItem,
      failedAt: new Date("2026-09-03T00:01:00.000Z"),
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
    eventBus.subscribe({ eventName: DeadLetterTestEvent.eventName, handlerClass: FailingHandler });

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
    });
    eventBus.subscribe({
      eventName: DeadLetterTestEvent.eventName,
      handlerClass: SuccessfulPeerHandler,
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
