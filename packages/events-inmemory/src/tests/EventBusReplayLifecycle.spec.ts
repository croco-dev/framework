import { createTestEventBus } from "./createTestEventBus";
import {
  DomainEvent,
  EventBusConfig,
  EventBusIntakeClosedProblem,
  EventBusStats,
  type DeadLetterItem,
  type EventHandler,
} from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeadLetterQueueNotConfiguredProblem,
  InMemoryDeadLetterQueue,
  type InMemoryEventBus,
  InvalidDeadLetterQueueLimitProblem,
} from "../index";

class ReplayLifecycleEvent extends DomainEvent {
  static readonly eventName = "replay-lifecycle";

  constructor(readonly value: string) {
    super();
  }
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

class ControlledDequeueQueue extends InMemoryDeadLetterQueue {
  readonly dequeueStarted = createDeferred();
  readonly releaseDequeue = createDeferred();

  override async dequeue<TEvent extends DomainEvent>(limit?: number) {
    const items = await super.dequeue<TEvent>(limit);
    this.dequeueStarted.resolve();
    await this.releaseDequeue.promise;
    return items;
  }
}

function deadLetter(
  value: string,
  handlerId = "ReplayHandler",
): DeadLetterItem<ReplayLifecycleEvent> {
  return {
    event: new ReplayLifecycleEvent(value),
    handlerId,
    failedAt: new Date(),
    reason: "handler-retries-exhausted",
    retryCount: 0,
  };
}

function subscribe(
  bus: InMemoryEventBus<ReplayLifecycleEvent>,
  handlerClass: new () => EventHandler<ReplayLifecycleEvent>,
  handler: EventHandler<ReplayLifecycleEvent>,
) {
  Container.set(handlerClass, handler);
  bus.subscribe({
    eventName: ReplayLifecycleEvent.eventName,
    handlerClass,
    handlerId: "ReplayHandler",
  });
}

describe("InMemoryEventBus replay shutdown lifecycle", () => {
  beforeEach(() => {
    Container.reset();
    EventBusConfig.setStats(new EventBusStats());
  });

  it("rejects replay after shutdown before dequeuing dead letters", async () => {
    class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
      handle = vi.fn();
    }
    const queue = new InMemoryDeadLetterQueue();
    await queue.enqueue(deadLetter("queued"));
    const dequeue = vi.spyOn(queue, "dequeue");
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    subscribe(bus, ReplayHandler, new ReplayHandler());

    await expect(bus.shutdown()).resolves.toMatchObject({ status: "drained" });

    await expect(bus.replayDeadLetters()).rejects.toBeInstanceOf(EventBusIntakeClosedProblem);
    expect(dequeue).not.toHaveBeenCalled();
    await expect(queue.size()).resolves.toBe(1);
  });

  it("preserves the missing dead-letter queue problem after shutdown", async () => {
    const bus = createTestEventBus<ReplayLifecycleEvent>();
    await expect(bus.shutdown()).resolves.toMatchObject({ status: "drained" });

    await expect(bus.replayDeadLetters()).rejects.toBeInstanceOf(
      DeadLetterQueueNotConfiguredProblem,
    );
  });

  it("preserves replay limit validation after shutdown without dequeuing", async () => {
    const queue = new InMemoryDeadLetterQueue();
    await queue.enqueue(deadLetter("invalid-limit"));
    const dequeue = vi.spyOn(queue, "dequeue");
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    await expect(bus.shutdown()).resolves.toMatchObject({ status: "drained" });

    await expect(bus.replayDeadLetters(0)).rejects.toBeInstanceOf(
      InvalidDeadLetterQueueLimitProblem,
    );
    expect(dequeue).not.toHaveBeenCalled();
    await expect(queue.size()).resolves.toBe(1);
  });

  it("requeues a dead letter dequeued while shutdown closes intake without invoking its handler", async () => {
    const handle = vi.fn();
    class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
      handle = handle;
    }
    const queue = new ControlledDequeueQueue();
    await queue.enqueue(deadLetter("pending-dequeue"));
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    subscribe(bus, ReplayHandler, new ReplayHandler());

    const replay = bus.replayDeadLetters();
    await queue.dequeueStarted.promise;
    const shutdown = bus.shutdown();
    let drained = false;
    void shutdown.then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    queue.releaseDequeue.resolve();

    await expect(replay).resolves.toMatchObject({
      attempted: 1,
      succeeded: 0,
      failed: 1,
      failures: [{ requeued: true, error: { code: "events-core/event-bus-intake-closed" } }],
    });
    await expect(shutdown).resolves.toEqual({ status: "drained", unfinishedHandlers: [] });
    expect(handle).not.toHaveBeenCalled();
    await expect(queue.size()).resolves.toBe(1);
  });

  it("returns recovery evidence when shutdown prevents replay and requeue storage fails", async () => {
    class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
      handle = vi.fn();
    }
    const queue = new ControlledDequeueQueue();
    await queue.enqueue(deadLetter("storage-failure"));
    const storageError = new Error("requeue unavailable");
    const enqueue = vi.spyOn(queue, "enqueue").mockRejectedValueOnce(storageError);
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    subscribe(bus, ReplayHandler, new ReplayHandler());

    const replay = bus.replayDeadLetters();
    await queue.dequeueStarted.promise;
    const shutdown = bus.shutdown();
    let drained = false;
    void shutdown.then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    queue.releaseDequeue.resolve();

    await expect(replay).resolves.toMatchObject({
      attempted: 1,
      succeeded: 0,
      failed: 1,
      failures: [
        {
          requeued: false,
          storageError,
          error: { code: "events-core/event-bus-intake-closed" },
          item: { event: expect.objectContaining({ value: "storage-failure" }) },
        },
      ],
    });
    await expect(shutdown).resolves.toEqual({ status: "drained", unfinishedHandlers: [] });
    expect(enqueue).toHaveBeenCalledOnce();
    await expect(queue.size()).resolves.toBe(0);
  });

  it.each(["blocked", "resumed"] as const)(
    "requeues a %s capacity waiter when shutdown starts",
    async (phase) => {
      const started = createDeferred();
      const release = createDeferred();
      const calls: string[] = [];
      class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
        async handle(event: ReplayLifecycleEvent): Promise<void> {
          calls.push(event.value);
          if (event.value === "active-publish") {
            started.resolve();
            await release.promise;
          }
        }
      }
      const queue = new ControlledDequeueQueue();
      await queue.enqueue(deadLetter("blocked-replay"));
      queue.releaseDequeue.resolve();
      const bus = createTestEventBus<ReplayLifecycleEvent>({
        deadLetterQueue: queue,
        maxConcurrency: 1,
        backpressureStrategy: "block",
      });
      const waiterStarted = createDeferred();
      const slotReady = createDeferred();
      const continueReplay = createDeferred();
      const waitForSlotOwner = bus as unknown as {
        waitForSlot(signal?: AbortSignal): Promise<void>;
      };
      const waitForSlot = waitForSlotOwner.waitForSlot.bind(bus);
      vi.spyOn(waitForSlotOwner, "waitForSlot").mockImplementation(async (signal) => {
        const waiting = waitForSlot(signal);
        waiterStarted.resolve();
        await waiting;
        slotReady.resolve();
        if (phase === "resumed") {
          await continueReplay.promise;
        }
      });
      subscribe(bus, ReplayHandler, new ReplayHandler());
      const publishing = bus.publish(new ReplayLifecycleEvent("active-publish"));
      await started.promise;
      const replay = bus.replayDeadLetters();
      await waiterStarted.promise;
      if (phase === "resumed") {
        release.resolve();
        await slotReady.promise;
      }

      const shutdown = bus.shutdown({ timeoutMs: 1_000 });
      continueReplay.resolve();

      await expect(replay).resolves.toMatchObject({
        attempted: 1,
        succeeded: 0,
        failed: 1,
        failures: [{ requeued: true, error: { code: "events-core/event-bus-intake-closed" } }],
      });
      expect(calls).toEqual(["active-publish"]);
      await expect(queue.size()).resolves.toBe(1);
      release.resolve();
      await expect(Promise.all([publishing, shutdown])).resolves.toEqual([
        undefined,
        { status: "drained", unfinishedHandlers: [] },
      ]);
    },
  );

  it("drains a started replay handler without starting a later item from the dequeued batch", async () => {
    const started = createDeferred();
    const release = createDeferred();
    const calls: string[] = [];
    class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
      async handle(event: ReplayLifecycleEvent): Promise<void> {
        calls.push(event.value);
        if (event.value === "started") {
          started.resolve();
          await release.promise;
        }
      }
    }
    const queue = new InMemoryDeadLetterQueue();
    await queue.enqueue(deadLetter("started"));
    await queue.enqueue(deadLetter("later"));
    const bus = createTestEventBus<ReplayLifecycleEvent>({
      deadLetterQueue: queue,
      maxConcurrency: 1,
    });
    subscribe(bus, ReplayHandler, new ReplayHandler());
    const replay = bus.replayDeadLetters();
    await started.promise;

    const shutdown = bus.shutdown({ timeoutMs: 1_000 });
    let shutdownSettled = false;
    void shutdown.then(() => {
      shutdownSettled = true;
    });
    await Promise.resolve();
    expect(shutdownSettled).toBe(false);
    release.resolve();

    await expect(replay).resolves.toMatchObject({
      attempted: 2,
      succeeded: 1,
      failed: 1,
      failures: [{ requeued: true, error: { code: "events-core/event-bus-intake-closed" } }],
    });
    await expect(shutdown).resolves.toEqual({ status: "drained", unfinishedHandlers: [] });
    expect(calls).toEqual(["started"]);
    await expect(queue.peek<ReplayLifecycleEvent>()).resolves.toEqual([
      expect.objectContaining({ event: expect.objectContaining({ value: "later" }) }),
    ]);
  });

  it.each(["timeout", "cancel"] as const)(
    "reports pending dequeue on %s without consuming a handler slot",
    async (ending) => {
      vi.useFakeTimers();
      try {
        const queue = new ControlledDequeueQueue();
        await queue.enqueue(deadLetter("pending"));
        const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
        const replay = bus.replayDeadLetters();
        await queue.dequeueStarted.promise;
        const controller = new AbortController();
        const shutdown = bus.shutdown({ timeoutMs: 100, signal: controller.signal });
        expect(bus.getRunningHandlerCount()).toBe(0);
        if (ending === "timeout") await vi.advanceTimersByTimeAsync(100);
        else controller.abort();
        const result = await shutdown;
        expect(result).toMatchObject({
          status: ending === "timeout" ? "timed-out" : "cancelled",
          unfinishedHandlers: [],
          unfinishedReplays: [
            { replayId: expect.any(String), phase: "dequeue", startTime: expect.any(Number) },
          ],
        });
        await expect(bus.replayDeadLetters()).rejects.toBeInstanceOf(EventBusIntakeClosedProblem);
        queue.releaseDequeue.resolve();
        await replay;
        await expect(bus.shutdown()).resolves.toEqual({
          status: "drained",
          unfinishedHandlers: [],
        });
        expect(result).toMatchObject({ unfinishedReplays: [{ phase: "dequeue" }] });
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("waits for every replay requeue and preserves failed storage recovery evidence", async () => {
    const queue = new ControlledDequeueQueue();
    await queue.enqueue(deadLetter("first"));
    await queue.enqueue(deadLetter("second"));
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    const first = bus.replayDeadLetters(1);
    const second = bus.replayDeadLetters(1);
    await queue.dequeueStarted.promise;
    const requeueStarted = createDeferred();
    const releaseRequeue = createDeferred();
    const storageError = new Error("storage unavailable");
    vi.spyOn(queue, "enqueue").mockImplementation(async (item) => {
      if ((item.event as ReplayLifecycleEvent).value === "second") {
        requeueStarted.resolve();
        await releaseRequeue.promise;
        throw storageError;
      }
      await InMemoryDeadLetterQueue.prototype.enqueue.call(queue, item);
    });
    const shutdown = bus.shutdown();
    const anotherShutdown = bus.shutdown();
    let drained = false;
    void shutdown.then(() => {
      drained = true;
    });
    queue.releaseDequeue.resolve();
    await first;
    await requeueStarted.promise;
    expect(drained).toBe(false);
    expect(bus.getRunningHandlerCount()).toBe(0);
    const controller = new AbortController();
    controller.abort();
    await expect(bus.shutdown({ signal: controller.signal })).resolves.toMatchObject({
      status: "cancelled",
      unfinishedHandlers: [],
      unfinishedReplays: [{ phase: "requeue" }],
    });
    releaseRequeue.resolve();
    await expect(second).resolves.toMatchObject({
      failed: 1,
      failures: [{ requeued: false, storageError, item: { event: { value: "second" } } }],
    });
    await expect(Promise.all([shutdown, anotherShutdown])).resolves.toEqual([
      { status: "drained", unfinishedHandlers: [] },
      { status: "drained", unfinishedHandlers: [] },
    ]);
    await expect(queue.peek<ReplayLifecycleEvent>()).resolves.toMatchObject([
      { event: { value: "first" } },
    ]);
  });

  it("releases drain tracking when dequeue rejects", async () => {
    const queue = new ControlledDequeueQueue();
    const storageError = new Error("dequeue unavailable");
    vi.spyOn(queue, "dequeue").mockImplementation(async () => {
      queue.dequeueStarted.resolve();
      await queue.releaseDequeue.promise;
      throw storageError;
    });
    const bus = createTestEventBus<ReplayLifecycleEvent>({ deadLetterQueue: queue });
    const replay = bus.replayDeadLetters();
    const rejected = expect(replay).rejects.toBe(storageError);
    await queue.dequeueStarted.promise;
    const shutdown = bus.shutdown();
    let drained = false;
    void shutdown.then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    queue.releaseDequeue.resolve();
    await rejected;
    await expect(shutdown).resolves.toEqual({ status: "drained", unfinishedHandlers: [] });
  });

  it("keeps handler capacity available while a replay is waiting on storage", async () => {
    class ReplayHandler implements EventHandler<ReplayLifecycleEvent> {
      handle = vi.fn();
    }
    const queue = new ControlledDequeueQueue();
    const bus = createTestEventBus<ReplayLifecycleEvent>({
      deadLetterQueue: queue,
      maxConcurrency: 1,
    });
    const handler = new ReplayHandler();
    subscribe(bus, ReplayHandler, handler);
    const replay = bus.replayDeadLetters();
    await queue.dequeueStarted.promise;
    await bus.publish(new ReplayLifecycleEvent("live"));
    expect(handler.handle).toHaveBeenCalledOnce();
    queue.releaseDequeue.resolve();
    await expect(replay).resolves.toMatchObject({ attempted: 0 });
    await expect(bus.shutdown()).resolves.toEqual({ status: "drained", unfinishedHandlers: [] });
  });
});
