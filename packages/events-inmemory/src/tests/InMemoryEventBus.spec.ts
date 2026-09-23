import {
  createEventBusShutdownHook,
  DomainEvent,
  EventBusConfig,
  EventBusIntakeClosedProblem,
  EventPublisher,
  EventBusStats,
  type EventPublishing,
  type HandlerResolver,
  InvalidEventBusDrainTimeoutProblem,
  type EventHandler,
  type EventSubscription,
} from "@croco/events-core";
import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
  ShutdownManager,
  type TransactionContext,
} from "@croco/framework-context";
import * as telemetryApi from "@croco/telemetry-api";
import * as otelApi from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventPublishDroppedProblem,
  EventPublishFailedError,
  InMemoryDeadLetterQueue,
  InMemoryEventBus,
  InvalidEventBusConfigurationProblem,
  MAX_EVENT_BUS_CONCURRENCY,
  MAX_EVENT_BUS_TIMEOUT_MS,
  MissingEventHandlerResolverProblem,
} from "../index";
import { createTestEventBus } from "./createTestEventBus";

class TestEvent extends DomainEvent {
  static readonly eventName = "TestEvent";

  constructor(public readonly message: string) {
    super();
  }
}

class MutablePayloadEvent extends DomainEvent {
  static readonly eventName = "MutablePayloadEvent";

  constructor(
    public payload: {
      nested: {
        count: number;
      };
    },
  ) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  public handledEvents: TestEvent[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

class FailingHandler implements EventHandler<TestEvent> {
  async handle(): Promise<void> {
    throw new Error("Handler failed intentionally");
  }
}

function createDeferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  if (!resolve) {
    throw new Error("Deferred resolver was not initialized");
  }

  return { promise, resolve };
}

describe("InMemoryEventBus", () => {
  let eventBus!: InMemoryEventBus;
  let testHandler!: TestHandler;

  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    EventBusConfig.setStats(new EventBusStats());
    eventBus = createTestEventBus();
    testHandler = new TestHandler();
    Container.reset();
  });

  describe("subscribe", () => {
    it("requires explicit resolution even when a handler is globally registered", async () => {
      Container.set(TestHandler, testHandler);
      const isolatedBus = new InMemoryEventBus<TestEvent>();
      isolatedBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      await expect(isolatedBus.publish(new TestEvent("missing-resolver"))).rejects.toMatchObject({
        failures: [{ error: expect.any(MissingEventHandlerResolverProblem) }],
      });
      expect(testHandler.handledEvents).toEqual([]);
    });

    it("keeps explicit resolvers isolated across buses", async () => {
      const firstHandler = new TestHandler();
      const secondHandler = new TestHandler();
      const firstBus = new InMemoryEventBus<TestEvent>({
        handlerResolver: { resolve: vi.fn().mockReturnValue(firstHandler) },
      });
      const secondBus = new InMemoryEventBus<TestEvent>({
        handlerResolver: { resolve: vi.fn().mockReturnValue(secondHandler) },
      });
      firstBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
      secondBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      await Promise.all([
        firstBus.publish(new TestEvent("first")),
        secondBus.publish(new TestEvent("second")),
      ]);

      expect(firstHandler.handledEvents.map((event) => event.message)).toEqual(["first"]);
      expect(secondHandler.handledEvents.map((event) => event.message)).toEqual(["second"]);
    });

    it("uses only the explicitly configured logger and inspector", async () => {
      const logger = { error: vi.fn() };
      const runtimeInspector = { recordEvent: vi.fn() };
      const isolatedBus = new InMemoryEventBus<TestEvent>({ logger, runtimeInspector });
      const handler = new FailingHandler();
      isolatedBus.subscribe({ eventName: "TestEvent", handlerClass: FailingHandler, handler });

      await expect(isolatedBus.publish(new TestEvent("failure"))).rejects.toBeInstanceOf(
        EventPublishFailedError,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "EventHandler error (TestEvent):",
        expect.any(Error),
      );
      expect(runtimeInspector.recordEvent).toHaveBeenCalled();
    });

    it("preserves handler retries and dead-letter delivery when the logger throws", async () => {
      const handlerError = new Error("handler failed");
      const queue = new InMemoryDeadLetterQueue();
      const handler = { handle: vi.fn(async () => Promise.reject(handlerError)) };
      const logger = {
        error: vi.fn(() => {
          throw new Error("logger failed");
        }),
      };
      const isolatedBus = new InMemoryEventBus<TestEvent>({
        logger,
        deadLetterQueue: queue,
        deadLetterPolicy: { maxRetries: 1, retryDelayMs: 0 },
      });
      isolatedBus.subscribe({
        eventName: TestEvent.eventName,
        handlerClass: FailingHandler,
        handler,
        handlerId: "failing-handler.v1",
      });

      await expect(isolatedBus.publish(new TestEvent("failure"))).rejects.toMatchObject({
        failures: [{ error: handlerError }],
      });
      expect(handler.handle).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledTimes(2);
      const [item] = await queue.peek<TestEvent>();
      expect(item?.handlerId).toBe("failing-handler.v1");
    });

    it("should use the handler instance resolved by EventBusConfig", async () => {
      class ContainerHandler implements EventHandler<TestEvent> {
        handle(): void {
          throw new Error("Container fallback should not be used");
        }
      }

      const resolvedHandler: EventHandler<TestEvent> = {
        handle: vi.fn(),
      };
      const resolver = {
        resolve(): EventHandler<TestEvent> {
          return resolvedHandler;
        },
      };
      const config = new EventBusConfig();
      config.setEventBus(eventBus);
      config.subscribe({
        eventName: TestEvent.eventName,
        handlerClass: ContainerHandler,
      });

      await config.start({ handlers: [], resolver: resolver as HandlerResolver });
      const event = new TestEvent("custom-resolver");
      await eventBus.publish(event);

      expect(resolvedHandler.handle).toHaveBeenCalledOnce();
      expect(resolvedHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: "custom-resolver" }),
      );
    });

    it("should subscribe a handler to an event", async () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription<TestEvent> = {
        eventName: "TestEvent",
        handlerClass: TestHandler,
      };
      eventBus.subscribe(subscription);

      const event = new TestEvent("subscribe-test");
      await eventBus.publish(event);
      expect(testHandler.handledEvents).toHaveLength(1);
      expect(testHandler.handledEvents[0].message).toBe("subscribe-test");
    });

    it("should use the explicit resolver after a provided handler is unsubscribed", async () => {
      class SharedHandler implements EventHandler<TestEvent> {
        handle = vi.fn();
      }

      const providedHandler = new SharedHandler();
      const containerHandler = new SharedHandler();
      Container.set(SharedHandler, containerHandler);
      eventBus.subscribe({
        eventName: TestEvent.eventName,
        handlerClass: SharedHandler,
        handler: providedHandler,
      });
      eventBus.unsubscribe({
        eventName: TestEvent.eventName,
        handlerClass: SharedHandler,
      });
      eventBus.subscribe({
        eventName: TestEvent.eventName,
        handlerClass: SharedHandler,
      });

      await eventBus.publish(new TestEvent("container-fallback"));

      expect(providedHandler.handle).not.toHaveBeenCalled();
      expect(containerHandler.handle).toHaveBeenCalledOnce();
    });

    it("should allow multiple handlers for same event", async () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: "TestEvent", handlerClass: Handler1 });
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: Handler2 });

      const event = new TestEvent("multi-handler");
      await eventBus.publish(event);
      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });
  });

  describe("publish", () => {
    it("should publish event to subscribed handler", async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      const event = new TestEvent("hello");
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(1);
      expect(testHandler.handledEvents[0].message).toBe("hello");
    });

    it("preserves preparation rejection identity while counting the failed publish", async () => {
      const preparationFailure = Object.create(null) as object;
      const event = new TestEvent("preparation-failure");
      Object.defineProperty(event, "message", {
        enumerable: true,
        get: () => {
          throw preparationFailure;
        },
      });

      await expect(eventBus.publish(event)).rejects.toBe(preparationFailure);
      expect(EventBusConfig.getStats()?.getStats()).toEqual({
        publishedCount: 0,
        failCount: 1,
        droppedPublishCount: 0,
      });
    });

    it("records publish and handler lifecycle events for the active runtime inspector request", async () => {
      const inspector = new RuntimeInspector();
      inspector.startRequest({ requestId: "event-req-1" });
      Container.set(DEV_INSPECTOR_TOKEN, inspector);
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      await Context.run({ requestId: "event-req-1" }, async () => {
        await eventBus.publish(new TestEvent("payload-not-recorded"));
      });
      inspector.finishRequest({
        requestId: "event-req-1",
        status: 200,
        outcome: "succeeded",
      });

      const timeline = inspector.snapshot().requests[0].timeline;

      expect(timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "event.publish",
            outcome: "started",
            name: "TestEvent",
            details: expect.objectContaining({
              subscriberCount: 1,
            }),
          }),
          expect.objectContaining({
            kind: "event.handler",
            outcome: "succeeded",
            name: "TestHandler",
            details: {
              eventName: "TestEvent",
              error: undefined,
            },
          }),
          expect.objectContaining({
            kind: "event.publish",
            outcome: "succeeded",
            name: "TestEvent",
          }),
        ]),
      );
      expect(JSON.stringify(timeline)).not.toContain("payload-not-recorded");
    });

    it("should publish to multiple handlers", async () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: "TestEvent", handlerClass: Handler1 });
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: Handler2 });

      const event = new TestEvent("broadcast");
      await eventBus.publish(event);

      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });

    describe("characterization", () => {
      it("should call subscribed handlers when publishing an event", async () => {
        class RecordingHandler implements EventHandler<TestEvent> {
          public readonly receivedMessages: string[] = [];

          async handle(event: TestEvent): Promise<void> {
            this.receivedMessages.push(event.message);
          }
        }

        const handler = new RecordingHandler();
        Container.set(RecordingHandler, handler);
        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: RecordingHandler,
        });

        await eventBus.publish(new TestEvent("characterization-single"));

        expect(handler.receivedMessages).toEqual(["characterization-single"]);
      });

      it("should invoke multiple handlers in subscription order", async () => {
        const callSequence: string[] = [];

        class FirstHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push("first");
          }
        }

        class SecondHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push("second");
          }
        }

        Container.set(FirstHandler, new FirstHandler());
        Container.set(SecondHandler, new SecondHandler());

        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: FirstHandler,
        });
        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: SecondHandler,
        });

        await eventBus.publish(new TestEvent("characterization-order"));

        expect(callSequence).toEqual(["first", "second"]);
      });

      it("should invoke three handlers in registration order", async () => {
        const callSequence: string[] = [];

        class FirstHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push("first");
          }
        }

        class SecondHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push("second");
          }
        }

        class ThirdHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push("third");
          }
        }

        Container.set(FirstHandler, new FirstHandler());
        Container.set(SecondHandler, new SecondHandler());
        Container.set(ThirdHandler, new ThirdHandler());

        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: FirstHandler,
        });
        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: SecondHandler,
        });
        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: ThirdHandler,
        });

        await eventBus.publish(new TestEvent("characterization-order-3"));

        expect(callSequence).toEqual(["first", "second", "third"]);
      });

      it("should log handler errors and continue with remaining handlers", async () => {
        class SuccessHandler extends TestHandler {}
        class FailHandler extends FailingHandler {}

        const successHandler = new SuccessHandler();
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        Container.set(SuccessHandler, successHandler);
        Container.set(FailHandler, new FailHandler());

        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: FailHandler,
        });
        eventBus.subscribe({
          eventName: "TestEvent",
          handlerClass: SuccessHandler,
        });

        await expect(
          eventBus.publish(new TestEvent("characterization-error")),
        ).rejects.toMatchObject({
          eventName: "TestEvent",
          failures: [
            expect.objectContaining({
              handlerName: "FailHandler",
              error: expect.objectContaining({
                message: "Handler failed intentionally",
              }),
            }),
          ],
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "EventHandler error (TestEvent):",
          expect.objectContaining({ message: "Handler failed intentionally" }),
        );
        expect(successHandler.handledEvents).toHaveLength(1);

        consoleErrorSpy.mockRestore();
      });

      it("should deliver independent event copies to each handler", async () => {
        class MutatingHandler implements EventHandler<MutablePayloadEvent> {
          public receivedEvent?: MutablePayloadEvent;

          async handle(event: MutablePayloadEvent): Promise<void> {
            this.receivedEvent = event;
            event.payload.nested.count = 99;
            event.metadata.custom = { changed: true };
          }
        }

        class ObservingHandler implements EventHandler<MutablePayloadEvent> {
          public receivedEvent?: MutablePayloadEvent;
          public observedCount?: number;
          public observedCustomMetadata?: unknown;

          async handle(event: MutablePayloadEvent): Promise<void> {
            this.receivedEvent = event;
            this.observedCount = event.payload.nested.count;
            this.observedCustomMetadata = event.metadata.custom;
          }
        }

        const mutatingHandler = new MutatingHandler();
        const observingHandler = new ObservingHandler();

        Container.set(MutatingHandler, mutatingHandler);
        Container.set(ObservingHandler, observingHandler);

        eventBus.subscribe({
          eventName: MutablePayloadEvent.eventName,
          handlerClass: MutatingHandler,
        });
        eventBus.subscribe({
          eventName: MutablePayloadEvent.eventName,
          handlerClass: ObservingHandler,
        });

        const event = new MutablePayloadEvent({ nested: { count: 1 } });
        await eventBus.publish(event);

        expect(mutatingHandler.receivedEvent).toBeDefined();
        expect(observingHandler.receivedEvent).toBeDefined();
        expect(mutatingHandler.receivedEvent).not.toBe(event);
        expect(observingHandler.receivedEvent).not.toBe(event);
        expect(mutatingHandler.receivedEvent).not.toBe(observingHandler.receivedEvent);
        expect(observingHandler.observedCount).toBe(1);
        expect(observingHandler.observedCustomMetadata).toBeUndefined();
        expect(event.payload.nested.count).toBe(1);
        expect(event.metadata).toEqual({});
      });
    });

    it("should not fail if no handlers subscribed", async () => {
      const event = new TestEvent("orphan");
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
    });

    it("should continue with other handlers if one fails", async () => {
      class SuccessHandler extends TestHandler {}
      class FailHandler extends FailingHandler {}

      const successHandler = new SuccessHandler();
      const failHandler = new FailHandler();

      Container.set(SuccessHandler, successHandler);
      Container.set(FailHandler, failHandler);

      eventBus.subscribe({ eventName: "TestEvent", handlerClass: FailHandler });
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SuccessHandler,
      });

      const event = new TestEvent("test");
      await expect(eventBus.publish(event)).rejects.toMatchObject({
        eventName: "TestEvent",
        failures: [
          expect.objectContaining({
            handlerName: "FailHandler",
            error: expect.objectContaining({
              message: "Handler failed intentionally",
            }),
          }),
        ],
      });
      expect(successHandler.handledEvents).toHaveLength(1);
      expect(EventBusConfig.getStats()?.getStats()).toEqual({
        publishedCount: 0,
        failCount: 1,
        droppedPublishCount: 0,
      });
    });

    it("should not mutate original event metadata when publishing same event twice", async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      const event = new TestEvent("immutable");
      const originalMetadata = event.metadata;

      await eventBus.publish(event);
      await eventBus.publish(event);

      expect(event.metadata).toEqual({});
      expect(event.metadata).toBe(originalMetadata);
    });

    it("should isolate traceContext between publishes when same event instance is reused", async () => {
      class TraceContextMutatingHandler implements EventHandler<TestEvent> {
        public readonly traceContextSpanIds: string[] = [];

        async handle(event: TestEvent): Promise<void> {
          const { traceContext } = event.metadata;
          const spanId = traceContext?.spanId;
          if (traceContext && spanId) {
            this.traceContextSpanIds.push(spanId);
            traceContext.spanId = "mutated-by-handler";
          }
        }
      }

      const handler = new TraceContextMutatingHandler();
      Container.set(TraceContextMutatingHandler, handler);
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: TraceContextMutatingHandler,
      });

      const sharedTraceContext = {
        traceId: "trace-1",
        spanId: "span-1",
        traceFlags: 1,
        isValid: true,
      };
      const traceInfoSpy = vi
        .spyOn(telemetryApi, "getActiveTraceInfo")
        .mockReturnValue(sharedTraceContext);

      const publishSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const handleSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            _options: { attributes: Record<string, unknown> },
            callback: (span: typeof publishSpan) => Promise<void>,
          ) => {
            const span = name.startsWith("event.publish:") ? publishSpan : handleSpan;
            await callback(span);
          },
        ),
      };

      Object.defineProperty(eventBus, "tracer", {
        value: mockTracer,
      });

      const event = new TestEvent("trace-context-copy");
      await eventBus.publish(event);
      await eventBus.publish(event);

      expect(handler.traceContextSpanIds).toEqual(["span-1", "span-1"]);
      expect(sharedTraceContext.spanId).toBe("span-1");
      traceInfoSpy.mockRestore();
    });

    it("should restore trace context before starting handler spans", async () => {
      const handler = new TestHandler();
      Container.set(TestHandler, handler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      const traceInfoSpy = vi.spyOn(telemetryApi, "getActiveTraceInfo").mockReturnValue({
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: 1,
        isValid: true,
      });

      const contextWithSpy = vi.spyOn(otelApi.context, "with");
      const setSpanContextSpy = vi.spyOn(otelApi.trace, "setSpanContext");

      await eventBus.publish(new TestEvent("restore-trace-context"));

      expect(setSpanContextSpy).toHaveBeenCalledWith(expect.anything(), {
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: 1,
        isRemote: true,
      });
      expect(contextWithSpy).toHaveBeenCalled();

      traceInfoSpy.mockRestore();
      contextWithSpy.mockRestore();
      setSpanContextSpy.mockRestore();
    });

    it("should restore a valid unsampled remote parent context", async () => {
      const handler = new TestHandler();
      Container.set(TestHandler, handler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

      const traceInfoSpy = vi.spyOn(telemetryApi, "getActiveTraceInfo").mockReturnValue({
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: 0,
        isValid: true,
      });

      const contextWithSpy = vi.spyOn(otelApi.context, "with");
      const setSpanContextSpy = vi.spyOn(otelApi.trace, "setSpanContext");

      await eventBus.publish(new TestEvent("restore-unsampled-trace-context"));

      expect(setSpanContextSpy).toHaveBeenCalledWith(expect.anything(), {
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: 0,
        isRemote: true,
      });
      expect(contextWithSpy).toHaveBeenCalled();
      const parentContext = setSpanContextSpy.mock.results[0]?.value;
      expect(contextWithSpy).toHaveBeenCalledWith(parentContext, expect.any(Function));

      traceInfoSpy.mockRestore();
      contextWithSpy.mockRestore();
      setSpanContextSpy.mockRestore();
    });

    it("should pass Error object to recordException", async () => {
      const failHandler = new FailingHandler();
      Container.set(FailingHandler, failHandler);
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: FailingHandler,
      });

      const publishSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const handleSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            _options: { attributes: Record<string, unknown> },
            callback: (span: typeof publishSpan) => Promise<void>,
          ) => {
            const span = name.startsWith("event.publish:") ? publishSpan : handleSpan;
            await callback(span);
          },
        ),
      };

      Object.defineProperty(eventBus, "tracer", {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent("record-error"))).rejects.toThrow(
        EventPublishFailedError,
      );

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("should preserve error stack when recording exception", async () => {
      const expectedError = new Error("stack-preserve-target");

      class StackFailingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          throw expectedError;
        }
      }

      const failHandler = new StackFailingHandler();
      Container.set(StackFailingHandler, failHandler);
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: StackFailingHandler,
      });

      const publishSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const handleSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            _options: { attributes: Record<string, unknown> },
            callback: (span: typeof publishSpan) => Promise<void>,
          ) => {
            const span = name.startsWith("event.publish:") ? publishSpan : handleSpan;
            await callback(span);
          },
        ),
      };

      Object.defineProperty(eventBus, "tracer", {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent("record-stack-error"))).rejects.toThrow(
        EventPublishFailedError,
      );

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException).toHaveBeenCalledWith(expectedError);
      expect((handleSpan.recordException.mock.calls[0][0] as Error).stack).toBe(
        expectedError.stack,
      );
    });

    it("should mark publish span as error when any handler fails", async () => {
      class SuccessHandler extends TestHandler {}
      class FailHandler extends FailingHandler {}

      const successHandler = new SuccessHandler();
      const failHandler = new FailHandler();

      Container.set(SuccessHandler, successHandler);
      Container.set(FailHandler, failHandler);

      eventBus.subscribe({ eventName: "TestEvent", handlerClass: FailHandler });
      eventBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SuccessHandler,
      });

      const publishSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const handleSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            _options: { attributes: Record<string, unknown> },
            callback: (span: typeof publishSpan) => Promise<void>,
          ) => {
            const span = name.startsWith("event.publish:") ? publishSpan : handleSpan;
            await callback(span);
          },
        ),
      };

      Object.defineProperty(eventBus, "tracer", {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent("status-check"))).rejects.toMatchObject({
        eventName: "TestEvent",
        failures: [
          expect.objectContaining({
            handlerName: "FailHandler",
            error: expect.objectContaining({
              message: "Handler failed intentionally",
            }),
          }),
        ],
      });

      expect(publishSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "1 event handler(s) failed while publishing TestEvent",
      });
      expect(publishSpan.recordException).toHaveBeenCalledWith(expect.any(EventPublishFailedError));
      expect(successHandler.handledEvents).toHaveLength(1);
    });

    it("should isolate mutable payload between handlers in the same publish", async () => {
      class MutatingHandler implements EventHandler<MutablePayloadEvent> {
        async handle(event: MutablePayloadEvent): Promise<void> {
          event.payload.nested.count = 99;
          event.metadata.custom = { changed: true };
        }
      }

      class ObservingHandler implements EventHandler<MutablePayloadEvent> {
        public readonly observedCounts: number[] = [];
        public readonly observedMetadata: Array<Record<string, unknown>> = [];

        async handle(event: MutablePayloadEvent): Promise<void> {
          this.observedCounts.push(event.payload.nested.count);
          this.observedMetadata.push(event.metadata);
        }
      }

      const mutatingHandler = new MutatingHandler();
      const observingHandler = new ObservingHandler();

      Container.set(MutatingHandler, mutatingHandler);
      Container.set(ObservingHandler, observingHandler);

      eventBus.subscribe({
        eventName: MutablePayloadEvent.eventName,
        handlerClass: MutatingHandler,
      });
      eventBus.subscribe({
        eventName: MutablePayloadEvent.eventName,
        handlerClass: ObservingHandler,
      });

      const event = new MutablePayloadEvent({ nested: { count: 1 } });

      await eventBus.publish(event);

      expect(event.payload.nested.count).toBe(1);
      expect(event.metadata).toEqual({});
      expect(observingHandler.observedCounts).toEqual([1]);
      expect(observingHandler.observedMetadata).toHaveLength(1);
      expect(observingHandler.observedMetadata[0]).not.toHaveProperty("custom");
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe a handler", async () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription<TestEvent> = {
        eventName: "TestEvent",
        handlerClass: TestHandler,
      };

      eventBus.subscribe(subscription);
      eventBus.unsubscribe(subscription);

      const event = new TestEvent("after-unsubscribe");
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it("should not fail when unsubscribing non-existent handler", () => {
      const subscription: EventSubscription<TestEvent> = {
        eventName: "TestEvent",
        handlerClass: TestHandler,
      };
      expect(() => eventBus.unsubscribe(subscription)).not.toThrow();
    });

    it("should preserve active handlers until they settle after unsubscribe", async () => {
      const started = createDeferred();
      const release = createDeferred();
      const handledMessages: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handledMessages.push(event.message);
          started.resolve();
          await release.promise;
        }
      }

      const limitedBus = createTestEventBus({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SlowHandler,
      });

      const publishPromise = limitedBus.publish(new TestEvent("active"));
      await started.promise;

      expect(limitedBus.getRunningHandlerCount()).toBe(1);

      limitedBus.unsubscribe({
        eventName: "TestEvent",
        handlerClass: SlowHandler,
      });

      expect(limitedBus.getRunningHandlerCount()).toBe(1);
      await limitedBus.publish(new TestEvent("after-unsubscribe"));
      expect(handledMessages).toEqual(["active"]);

      release.resolve();
      await publishPromise;
      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all subscriptions", async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
      eventBus.clear();

      const event = new TestEvent("after-clear");
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it("should preserve active handlers until they settle after clear", async () => {
      const started = createDeferred();
      const release = createDeferred();
      const handledMessages: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handledMessages.push(event.message);
          started.resolve();
          await release.promise;
        }
      }

      const limitedBus = createTestEventBus({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SlowHandler,
      });

      const publishPromise = limitedBus.publish(new TestEvent("active"));
      await started.promise;

      expect(limitedBus.getRunningHandlerCount()).toBe(1);

      limitedBus.clear();

      expect(limitedBus.getRunningHandlerCount()).toBe(1);
      await limitedBus.publish(new TestEvent("after-clear"));
      expect(handledMessages).toEqual(["active"]);

      release.resolve();
      await publishPromise;
      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });
  });

  describe("backpressure", () => {
    it.each(["invalid", "", null, 0, false, {}])(
      "rejects invalid backpressureStrategy %j at construction",
      (value) => {
        expect(() => createTestEventBus({ backpressureStrategy: value as "block" })).toThrow(
          /backpressureStrategy must be block, drop, or error/,
        );
      },
    );

    it.each([undefined, "block", "drop", "error"] as const)(
      "accepts supported backpressureStrategy %s",
      (backpressureStrategy) => {
        expect(() => createTestEventBus({ backpressureStrategy })).not.toThrow();
      },
    );

    const invalidConcurrencyValues = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null as unknown as number,
      -1,
      0,
      1.5,
      MAX_EVENT_BUS_CONCURRENCY + 1,
    ];
    const invalidTimeoutValues = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null as unknown as number,
      -1,
      0,
      1.5,
      MAX_EVENT_BUS_TIMEOUT_MS + 1,
    ];

    it.each(invalidConcurrencyValues)(
      "rejects invalid maxConcurrency %s at construction",
      (value) => {
        expect(() => createTestEventBus<TestEvent>({ maxConcurrency: value })).toThrow(
          InvalidEventBusConfigurationProblem,
        );

        try {
          createTestEventBus<TestEvent>({ maxConcurrency: value });
        } catch (error) {
          expect(error).toMatchObject({
            code: "events-inmemory/invalid-configuration",
            option: "maxConcurrency",
            value,
          });
        }
      },
    );

    it.each(invalidTimeoutValues)(
      "rejects invalid backpressureTimeoutMs %s at construction",
      (value) => {
        expect(() => createTestEventBus<TestEvent>({ backpressureTimeoutMs: value })).toThrow(
          InvalidEventBusConfigurationProblem,
        );

        try {
          createTestEventBus<TestEvent>({ backpressureTimeoutMs: value });
        } catch (error) {
          expect(error).toMatchObject({
            code: "events-inmemory/invalid-configuration",
            option: "backpressureTimeoutMs",
            value,
          });
        }
      },
    );

    it.each([1, MAX_EVENT_BUS_CONCURRENCY])(
      "accepts maxConcurrency boundary %s without rounding",
      (maxConcurrency) => {
        expect(() => createTestEventBus<TestEvent>({ maxConcurrency })).not.toThrow();
      },
    );

    it.each([1, MAX_EVENT_BUS_TIMEOUT_MS])(
      "accepts backpressureTimeoutMs boundary %s without timer clamping",
      (backpressureTimeoutMs) => {
        expect(() => createTestEventBus<TestEvent>({ backpressureTimeoutMs })).not.toThrow();
      },
    );

    it("preserves existing valid tuning combinations", () => {
      expect(() =>
        createTestEventBus<TestEvent>({
          maxConcurrency: 10,
          backpressureStrategy: "block",
          backpressureTimeoutMs: 5000,
        }),
      ).not.toThrow();
    });

    it("should respect maxConcurrency with block strategy", async () => {
      const executionOrder: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionOrder.push(`start-${event.message}`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          executionOrder.push(`end-${event.message}`);
        }
      }

      const limitedBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "block",
      });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SlowHandler,
      });

      await Promise.all([
        limitedBus.publish(new TestEvent("first")),
        limitedBus.publish(new TestEvent("second")),
        limitedBus.publish(new TestEvent("third")),
      ]);

      expect(executionOrder).toEqual([
        "start-first",
        "end-first",
        "start-second",
        "end-second",
        "start-third",
        "end-third",
      ]);
    });

    it.each(["unsubscribe", "clear"] as const)(
      "should not release a waiting publisher when subscriptions %s",
      async (operation) => {
        const firstStarted = createDeferred();
        const firstRelease = createDeferred();
        const secondStarted = createDeferred();
        const secondRelease = createDeferred();
        const executionOrder: string[] = [];

        class BlockingHandler implements EventHandler<TestEvent> {
          async handle(event: TestEvent): Promise<void> {
            executionOrder.push(`start-${event.message}`);
            if (event.message === "first") {
              firstStarted.resolve();
              await firstRelease.promise;
            } else {
              secondStarted.resolve();
              await secondRelease.promise;
            }
            executionOrder.push(`end-${event.message}`);
          }
        }

        const limitedBus = createTestEventBus<TestEvent>({
          maxConcurrency: 1,
          backpressureStrategy: "block",
        });
        const subscription = {
          eventName: "TestEvent",
          handlerClass: BlockingHandler,
        };

        Container.set(BlockingHandler, new BlockingHandler());
        limitedBus.subscribe(subscription);

        const firstPublish = limitedBus.publish(new TestEvent("first"));
        await firstStarted.promise;
        const secondPublish = limitedBus.publish(new TestEvent("second"));
        await Promise.resolve();

        const internals = limitedBus as unknown as {
          slotWaiters: Set<() => void>;
        };
        expect(internals.slotWaiters.size).toBe(1);

        if (operation === "unsubscribe") {
          limitedBus.unsubscribe(subscription);
        } else {
          limitedBus.clear();
        }

        expect(limitedBus.getRunningHandlerCount()).toBe(1);
        expect(executionOrder).toEqual(["start-first"]);

        firstRelease.resolve();
        await secondStarted.promise;
        expect(executionOrder).toEqual(["start-first", "end-first", "start-second"]);

        secondRelease.resolve();
        await Promise.all([firstPublish, secondPublish]);
        expect(limitedBus.getRunningHandlerCount()).toBe(0);
      },
    );

    it("should keep clear and re-subscribe invocation identifiers collision-free", async () => {
      const firstStarted = createDeferred();
      const firstRelease = createDeferred();
      const secondStarted = createDeferred();
      const secondRelease = createDeferred();

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          if (event.message === "first") {
            firstStarted.resolve();
            await firstRelease.promise;
          } else {
            secondStarted.resolve();
            await secondRelease.promise;
          }
        }
      }

      const limitedBus = createTestEventBus<TestEvent>({ maxConcurrency: 2 });
      const subscription = {
        eventName: "TestEvent",
        handlerClass: BlockingHandler,
      };

      Container.set(BlockingHandler, new BlockingHandler());
      limitedBus.subscribe(subscription);

      const firstPublish = limitedBus.publish(new TestEvent("first"));
      await firstStarted.promise;
      limitedBus.clear();
      limitedBus.subscribe(subscription);

      const secondPublish = limitedBus.publish(new TestEvent("second"));
      await secondStarted.promise;

      expect(limitedBus.getRunningHandlerCount()).toBe(2);
      expect(limitedBus.getRunningHandlers()).toHaveLength(2);

      firstRelease.resolve();
      secondRelease.resolve();
      await Promise.all([firstPublish, secondPublish]);
      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });

    it("should preserve failure aggregation when an active handler is unsubscribed", async () => {
      const started = createDeferred();
      const release = createDeferred();

      class DeferredFailingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          started.resolve();
          await release.promise;
          throw new Error("Deferred handler failed intentionally");
        }
      }

      const limitedBus = createTestEventBus<TestEvent>({ maxConcurrency: 1 });
      const subscription = {
        eventName: "TestEvent",
        handlerClass: DeferredFailingHandler,
      };

      Container.set(DeferredFailingHandler, new DeferredFailingHandler());
      limitedBus.subscribe(subscription);

      const publishPromise = limitedBus.publish(new TestEvent("failure"));
      await started.promise;
      limitedBus.unsubscribe(subscription);

      expect(limitedBus.getRunningHandlerCount()).toBe(1);
      release.resolve();
      await expect(publishPromise).rejects.toBeInstanceOf(EventPublishFailedError);
      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });

    it("should reject a fully dropped publish with explicit operational evidence", async () => {
      let releaseHandler!: () => void;
      let markHandlerStarted!: () => void;
      const handlerStarted = new Promise<void>((resolve) => {
        markHandlerStarted = resolve;
      });
      const handlerRelease = new Promise<void>((resolve) => {
        releaseHandler = resolve;
      });
      const handledMessages: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handledMessages.push(event.message);
          markHandlerStarted();
          await handlerRelease;
        }
      }

      const dropBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "drop",
      });
      const stats = new EventBusStats();
      EventBusConfig.setStats(stats);
      const inspector = new RuntimeInspector();
      inspector.startRequest({ requestId: "drop-req-1" });
      Container.set(DEV_INSPECTOR_TOKEN, inspector);

      const spans: Array<{
        name: string;
        attributes: Record<string, unknown>;
        span: {
          setStatus: ReturnType<typeof vi.fn>;
          setAttributes: ReturnType<typeof vi.fn>;
          recordException: ReturnType<typeof vi.fn>;
          end: ReturnType<typeof vi.fn>;
        };
      }> = [];
      const mockTracer = {
        startActiveSpan: vi.fn(
          async (
            name: string,
            options: { attributes: Record<string, unknown> },
            callback: (span: (typeof spans)[number]["span"]) => Promise<void>,
          ) => {
            const span = {
              setStatus: vi.fn(),
              setAttributes: vi.fn(),
              recordException: vi.fn(),
              end: vi.fn(),
            };
            spans.push({ name, attributes: options.attributes, span });
            await callback(span);
          },
        ),
      };
      Object.defineProperty(dropBus, "tracer", { value: mockTracer });

      Container.set(SlowHandler, new SlowHandler());
      dropBus.subscribe({ eventName: "TestEvent", handlerClass: SlowHandler });

      const firstPublish = Context.run({ requestId: "drop-req-1" }, () =>
        dropBus.publish(new TestEvent("first-secret")),
      );
      await handlerStarted;

      await expect(
        Context.run({ requestId: "drop-req-1" }, () =>
          dropBus.publish(new TestEvent("second-secret")),
        ),
      ).rejects.toMatchObject({
        eventName: "TestEvent",
        deliveredCount: 0,
        droppedCount: 1,
        failures: [],
      });

      releaseHandler();
      await firstPublish;
      inspector.finishRequest({ requestId: "drop-req-1", status: 500, outcome: "failed" });

      expect(handledMessages).toEqual(["first-secret"]);
      expect(stats.getStats()).toEqual({
        publishedCount: 1,
        failCount: 0,
        droppedPublishCount: 1,
      });

      const publishSpans = spans.filter(({ name }) => name === "event.publish:TestEvent");
      expect(publishSpans[1]?.attributes).toMatchObject({
        "event.subscriber_count": 1,
      });
      expect(publishSpans[1]?.span.setAttributes).toHaveBeenCalledWith({
        "event.delivered_count": 0,
        "event.dropped_count": 1,
      });
      expect(publishSpans[1]?.span.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
      expect(publishSpans[1]?.span.setStatus).not.toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.OK }),
      );
      expect(publishSpans[1]?.span.recordException).toHaveBeenCalledWith(
        expect.any(EventPublishDroppedProblem),
      );

      const timeline = inspector.snapshot().requests[0].timeline;
      expect(timeline).toContainEqual(
        expect.objectContaining({
          kind: "event.publish",
          outcome: "failed",
          name: "TestEvent",
          details: {
            subscriberCount: 1,
            deliveredCount: 0,
            droppedCount: 1,
          },
        }),
      );
      expect(JSON.stringify(timeline)).not.toContain("second-secret");
    });

    it("should report deterministic partial delivery counts", async () => {
      class FirstHandler extends TestHandler {}
      class SecondHandler extends TestHandler {}

      const firstHandler = new FirstHandler();
      const secondHandler = new SecondHandler();
      const dropBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "drop",
      });
      const availability = vi.spyOn(
        dropBus as unknown as { hasAvailableSlot(): boolean },
        "hasAvailableSlot",
      );
      availability.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);

      Container.set(FirstHandler, firstHandler);
      Container.set(SecondHandler, secondHandler);
      dropBus.subscribe({ eventName: "TestEvent", handlerClass: FirstHandler });
      dropBus.subscribe({ eventName: "TestEvent", handlerClass: SecondHandler });

      await expect(dropBus.publish(new TestEvent("partial"))).rejects.toMatchObject({
        eventName: "TestEvent",
        deliveredCount: 1,
        droppedCount: 1,
        failures: [],
      });
      expect(firstHandler.handledEvents).toHaveLength(1);
      expect(secondHandler.handledEvents).toHaveLength(0);
    });

    it("should preserve invoked handler failures when remaining subscribers are dropped", async () => {
      class FirstFailingHandler extends FailingHandler {}
      class SecondHandler extends TestHandler {}

      const dropBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "drop",
      });
      const availability = vi.spyOn(
        dropBus as unknown as { hasAvailableSlot(): boolean },
        "hasAvailableSlot",
      );
      availability.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const secondHandler = new SecondHandler();
      const inspector = new RuntimeInspector();
      inspector.startRequest({ requestId: "failure-drop-req" });
      Container.set(DEV_INSPECTOR_TOKEN, inspector);

      Container.set(FirstFailingHandler, new FirstFailingHandler());
      Container.set(SecondHandler, secondHandler);
      dropBus.subscribe({ eventName: "TestEvent", handlerClass: FirstFailingHandler });
      dropBus.subscribe({ eventName: "TestEvent", handlerClass: SecondHandler });

      try {
        await expect(
          Context.run({ requestId: "failure-drop-req" }, () =>
            dropBus.publish(new TestEvent("failure-and-drop-secret")),
          ),
        ).rejects.toMatchObject({
          eventName: "TestEvent",
          deliveredCount: 1,
          droppedCount: 1,
          failures: [
            expect.objectContaining({
              handlerName: "FirstFailingHandler",
              error: expect.objectContaining({
                message: "Handler failed intentionally",
              }),
            }),
          ],
        });
      } finally {
        consoleError.mockRestore();
      }

      inspector.finishRequest({ requestId: "failure-drop-req", status: 500, outcome: "failed" });

      expect(secondHandler.handledEvents).toHaveLength(0);
      const failedPublish = inspector
        .snapshot()
        .requests[0].timeline.find(
          (entry) => entry.kind === "event.publish" && entry.outcome === "failed",
        );
      expect(failedPublish).toMatchObject({
        name: "TestEvent",
      });
      expect(failedPublish?.details).toEqual({
        subscriberCount: 2,
        deliveredCount: 1,
        droppedCount: 1,
      });
      const serializedDetails = JSON.stringify(failedPublish?.details);
      expect(serializedDetails).not.toContain("FirstFailingHandler");
      expect(serializedDetails).not.toContain("Handler failed intentionally");
      expect(serializedDetails).not.toContain("failure-and-drop-secret");
    });

    it("should throw error when using error strategy", async () => {
      class SlowHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const errorBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "error",
      });

      Container.set(SlowHandler, new SlowHandler());
      errorBus.subscribe({ eventName: "TestEvent", handlerClass: SlowHandler });

      const promise1 = errorBus.publish(new TestEvent("first"));

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(errorBus.publish(new TestEvent("second"))).rejects.toThrow(
        "Backpressure exceeded",
      );

      await promise1;
    });

    it("should throw timeout problem when block strategy exceeds configured timeout", async () => {
      vi.useFakeTimers();

      try {
        class SlowHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        const timeoutBus = createTestEventBus<TestEvent>({
          maxConcurrency: 1,
          backpressureStrategy: "block",
          backpressureTimeoutMs: 25,
        });

        Container.set(SlowHandler, new SlowHandler());
        timeoutBus.subscribe({
          eventName: "TestEvent",
          handlerClass: SlowHandler,
        });

        const firstPublish = timeoutBus.publish(new TestEvent("first"));
        await vi.advanceTimersByTimeAsync(1);

        const secondPublish = timeoutBus.publish(new TestEvent("second"));
        const secondPublishExpectation = expect(secondPublish).rejects.toMatchObject({
          message: "Backpressure wait timed out after 25ms",
        });

        await vi.advanceTimersByTimeAsync(25);
        await secondPublishExpectation;

        await vi.advanceTimersByTimeAsync(100);
        await firstPublish;
      } finally {
        vi.useRealTimers();
      }
    });

    it("should time out block strategy with the default timeout when a slot never frees", async () => {
      vi.useFakeTimers();

      try {
        let resolveHandler: (() => void) | undefined;

        class BlockingHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            await new Promise<void>((resolve) => {
              resolveHandler = resolve;
            });
          }
        }

        const blockBus = createTestEventBus<TestEvent>({
          maxConcurrency: 1,
          backpressureStrategy: "block",
        });

        Container.set(BlockingHandler, new BlockingHandler());
        blockBus.subscribe({
          eventName: "TestEvent",
          handlerClass: BlockingHandler,
        });

        const firstPublish = blockBus.publish(new TestEvent("first"));
        await vi.advanceTimersByTimeAsync(1);

        const secondPublish = blockBus.publish(new TestEvent("second"));
        const secondPublishExpectation = expect(secondPublish).rejects.toMatchObject({
          message: "Backpressure wait timed out after 5000ms",
        });

        await vi.advanceTimersByTimeAsync(5000);
        await secondPublishExpectation;

        resolveHandler?.();
        await firstPublish;
      } finally {
        vi.useRealTimers();
      }
    });

    it("should abort a blocked publish without cancelling an active delivery", async () => {
      const handlerStarted = createDeferred();
      const releaseHandler = createDeferred();
      const handled: string[] = [];

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          if (event.message === "first") {
            handlerStarted.resolve();
            await releaseHandler.promise;
          }
          handled.push(event.message);
        }
      }

      const bus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1 });
      const publishing: EventPublishing<TestEvent> = bus;
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: "TestEvent", handlerClass: BlockingHandler });

      const firstPublish = bus.publish(new TestEvent("first"));
      await handlerStarted.promise;

      const controller = new AbortController();
      const blockedPublish = publishing.publish(new TestEvent("blocked"), {
        signal: controller.signal,
      });
      controller.abort();

      await expect(blockedPublish).rejects.toMatchObject({
        message: "Backpressure wait aborted",
      });
      releaseHandler.resolve();
      await firstPublish;
      await bus.publish(new TestEvent("next"));

      expect(handled).toEqual(["first", "next"]);
    });

    it("should reject a blocked publish with a previously aborted signal", async () => {
      const handlerStarted = createDeferred();
      const releaseHandler = createDeferred();
      const handled: string[] = [];

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handlerStarted.resolve();
          await releaseHandler.promise;
          handled.push(event.message);
        }
      }

      const bus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1 });
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: "TestEvent", handlerClass: BlockingHandler });

      const firstPublish = bus.publish(new TestEvent("first"));
      await handlerStarted.promise;

      const controller = new AbortController();
      controller.abort();
      await expect(
        bus.publish(new TestEvent("blocked"), { signal: controller.signal }),
      ).rejects.toMatchObject({
        message: "Backpressure wait aborted",
      });

      releaseHandler.resolve();
      await firstPublish;
      expect(handled).toEqual(["first"]);
    });

    it("should complete a delivery that started before its publish signal aborted", async () => {
      const handlerStarted = createDeferred();
      const releaseHandler = createDeferred();
      const handled: string[] = [];

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handlerStarted.resolve();
          await releaseHandler.promise;
          handled.push(event.message);
        }
      }

      const bus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1 });
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: "TestEvent", handlerClass: BlockingHandler });

      const controller = new AbortController();
      const publishing = bus.publish(new TestEvent("delivered"), { signal: controller.signal });
      await handlerStarted.promise;
      controller.abort();
      releaseHandler.resolve();

      await expect(publishing).resolves.toBeUndefined();
      expect(handled).toEqual(["delivered"]);
    });

    it("should wait for an available slot before the default timeout expires", async () => {
      const executionOrder: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionOrder.push(`start-${event.message}`);
          await new Promise((resolve) => setTimeout(resolve, 30));
          executionOrder.push(`end-${event.message}`);
        }
      }

      const blockBus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "block",
      });

      Container.set(SlowHandler, new SlowHandler());
      blockBus.subscribe({ eventName: "TestEvent", handlerClass: SlowHandler });

      await Promise.all([
        blockBus.publish(new TestEvent("first")),
        blockBus.publish(new TestEvent("second")),
      ]);

      expect(executionOrder).toEqual(["start-first", "end-first", "start-second", "end-second"]);
    });

    it("should track running handlers correctly", async () => {
      let resolveHandler: (() => void) | undefined;

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise<void>((resolve) => {
            resolveHandler = resolve;
          });
        }
      }

      const limitedBus = createTestEventBus<TestEvent>({ maxConcurrency: 1 });

      Container.set(BlockingHandler, new BlockingHandler());
      limitedBus.subscribe({
        eventName: "TestEvent",
        handlerClass: BlockingHandler,
      });

      const publishPromise = limitedBus.publish(new TestEvent("block"));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(limitedBus.getRunningHandlerCount()).toBe(1);
      expect(limitedBus.getRunningHandlers()).toHaveLength(1);
      expect(limitedBus.getRunningHandlers()[0].eventName).toBe("TestEvent");
      expect(limitedBus.getRunningHandlers()[0].handlerName).toBe("BlockingHandler");

      resolveHandler?.();
      await publishPromise;

      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });

    it("should allow unlimited concurrency by default", async () => {
      const executionOrder: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionOrder.push(`start-${event.message}`);
          await new Promise((resolve) => setTimeout(resolve, 20));
          executionOrder.push(`end-${event.message}`);
        }
      }

      const unlimitedBus = createTestEventBus<TestEvent>();

      Container.set(SlowHandler, new SlowHandler());
      unlimitedBus.subscribe({
        eventName: "TestEvent",
        handlerClass: SlowHandler,
      });

      await Promise.all([
        unlimitedBus.publish(new TestEvent("first")),
        unlimitedBus.publish(new TestEvent("second")),
        unlimitedBus.publish(new TestEvent("third")),
      ]);

      const starts = executionOrder.filter((e) => e.startsWith("start-"));
      expect(starts).toHaveLength(3);
    });
  });

  describe("shutdown lifecycle", () => {
    it("counts an after-commit preparation failure exactly once", async () => {
      class UnsupportedPayloadEvent extends DomainEvent {
        static readonly eventName = "UnsupportedPayloadEvent";
        readonly payload = () => undefined;
      }

      let registeredHook: (() => void | Promise<void>) | undefined;
      const onError = vi.fn();
      const txContext: TransactionContext = {
        isInTransaction: () => true,
        canRegisterAfterCommit: () => true,
        onAfterCommit: (hook) => {
          registeredHook = hook;
        },
      };
      const bus = createTestEventBus({ deadLetterQueue: new InMemoryDeadLetterQueue() });
      const config = EventBusConfig.getInstance();
      config.setEventBus(bus);
      new EventPublisher(config, txContext).publishAfterCommit(new UnsupportedPayloadEvent(), {
        onError,
      });

      await expect(registeredHook?.()).rejects.toMatchObject({
        code: "events-core/after-commit-publish-failed",
        cause: expect.objectContaining({
          code: "events-inmemory/unsupported-dead-letter-value",
        }),
      });
      expect(onError).toHaveBeenCalledOnce();
      expect(EventBusConfig.getStats()?.getStats()).toEqual({
        publishedCount: 0,
        failCount: 1,
        droppedPublishCount: 0,
      });
    });

    it("counts a rejected after-commit publish exactly once after intake closes", async () => {
      let registeredHook: (() => void | Promise<void>) | undefined;
      const onError = vi.fn();
      const txContext: TransactionContext = {
        isInTransaction: () => true,
        canRegisterAfterCommit: () => true,
        onAfterCommit: (hook) => {
          registeredHook = hook;
        },
      };
      const config = EventBusConfig.getInstance();
      config.setEventBus(eventBus);
      new EventPublisher(config, txContext).publishAfterCommit(new TestEvent("after-shutdown"), {
        onError,
      });
      await eventBus.shutdown();

      await expect(registeredHook?.()).rejects.toMatchObject({
        code: "events-core/after-commit-publish-failed",
        cause: expect.objectContaining({
          code: "events-core/event-bus-intake-closed",
        }),
      });
      expect(onError).toHaveBeenCalledOnce();
      expect(EventBusConfig.getStats()?.getStats()).toEqual({
        publishedCount: 0,
        failCount: 1,
        droppedPublishCount: 0,
      });
    });

    it("closes intake, releases backpressure waiters, and drains only started handlers", async () => {
      const firstStarted = createDeferred();
      const firstRelease = createDeferred();
      const handledMessages: string[] = [];

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          handledMessages.push(event.message);
          firstStarted.resolve();
          await firstRelease.promise;
        }
      }

      const bus = createTestEventBus<TestEvent>({
        maxConcurrency: 1,
        backpressureStrategy: "block",
      });
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: TestEvent.eventName, handlerClass: BlockingHandler });

      const firstPublish = bus.publish(new TestEvent("first"));
      await firstStarted.promise;
      const waitingPublishes = [
        bus.publish(new TestEvent("waiting-1")),
        bus.publish(new TestEvent("waiting-2")),
      ];
      await Promise.resolve();

      const internals = bus as unknown as { slotWaiters: Set<() => void> };
      expect(internals.slotWaiters.size).toBe(2);

      const shutdownPromise = bus.shutdown({ timeoutMs: 1_000 });

      await Promise.all(
        waitingPublishes.map((publish) =>
          expect(publish).rejects.toBeInstanceOf(EventBusIntakeClosedProblem),
        ),
      );
      await expect(bus.publish(new TestEvent("after-shutdown"))).rejects.toBeInstanceOf(
        EventBusIntakeClosedProblem,
      );
      expect(internals.slotWaiters.size).toBe(0);

      let shutdownSettled = false;
      void shutdownPromise.then(() => {
        shutdownSettled = true;
      });
      await Promise.resolve();
      expect(shutdownSettled).toBe(false);
      expect(bus.getRunningHandlerCount()).toBe(1);

      firstRelease.resolve();
      await firstPublish;
      await expect(shutdownPromise).resolves.toEqual({
        status: "drained",
        unfinishedHandlers: [],
      });
      expect(handledMessages).toEqual(["first"]);
    });

    it("does not start a later subscriber after shutdown begins", async () => {
      const firstStarted = createDeferred();
      const firstRelease = createDeferred();
      const secondHandle = vi.fn();

      class FirstBlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          firstStarted.resolve();
          await firstRelease.promise;
        }
      }

      class SecondHandler implements EventHandler<TestEvent> {
        handle(): void {
          secondHandle();
        }
      }

      const bus = createTestEventBus<TestEvent>();
      Container.set(FirstBlockingHandler, new FirstBlockingHandler());
      Container.set(SecondHandler, new SecondHandler());
      bus.subscribe({ eventName: TestEvent.eventName, handlerClass: FirstBlockingHandler });
      bus.subscribe({ eventName: TestEvent.eventName, handlerClass: SecondHandler });

      const publishPromise = bus.publish(new TestEvent("partial"));
      await firstStarted.promise;
      const shutdownPromise = bus.shutdown({ timeoutMs: 1_000 });
      firstRelease.resolve();

      await expect(publishPromise).rejects.toBeInstanceOf(EventBusIntakeClosedProblem);
      await expect(shutdownPromise).resolves.toEqual({
        status: "drained",
        unfinishedHandlers: [],
      });
      expect(secondHandle).not.toHaveBeenCalled();
    });

    it("returns timed-out handler evidence without reporting a successful drain", async () => {
      vi.useFakeTimers();
      const started = createDeferred();
      const release = createDeferred();

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          started.resolve();
          await release.promise;
        }
      }

      try {
        const bus = createTestEventBus<TestEvent>();
        Container.set(BlockingHandler, new BlockingHandler());
        bus.subscribe({ eventName: TestEvent.eventName, handlerClass: BlockingHandler });

        const publishPromise = bus.publish(new TestEvent("timeout"));
        await started.promise;
        const shutdownPromise = bus.shutdown({ timeoutMs: 25 });
        await vi.advanceTimersByTimeAsync(25);

        await expect(shutdownPromise).resolves.toMatchObject({
          status: "timed-out",
          unfinishedHandlers: [
            expect.objectContaining({
              eventName: TestEvent.eventName,
              handlerName: "BlockingHandler",
            }),
          ],
        });
        expect(bus.getRunningHandlerCount()).toBe(1);

        release.resolve();
        await publishPromise;
        await expect(bus.shutdown({ timeoutMs: 25 })).resolves.toEqual({
          status: "drained",
          unfinishedHandlers: [],
        });
      } finally {
        release.resolve();
        vi.useRealTimers();
      }
    });

    it("returns cancelled handler evidence when the drain signal aborts", async () => {
      const started = createDeferred();
      const release = createDeferred();

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          started.resolve();
          await release.promise;
        }
      }

      const bus = createTestEventBus<TestEvent>();
      const controller = new AbortController();
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: TestEvent.eventName, handlerClass: BlockingHandler });

      const publishPromise = bus.publish(new TestEvent("cancel"));
      await started.promise;
      const shutdownPromise = bus.shutdown({ signal: controller.signal, timeoutMs: 1_000 });
      controller.abort();

      await expect(shutdownPromise).resolves.toMatchObject({
        status: "cancelled",
        unfinishedHandlers: [expect.objectContaining({ handlerName: "BlockingHandler" })],
      });

      release.resolve();
      await publishPromise;
    });

    it.each([
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null as unknown as number,
      0,
      -1,
      1.5,
      2_147_483_648,
    ])("rejects invalid drain timeout %s without closing intake", async (timeoutMs) => {
      const bus = createTestEventBus<TestEvent>();

      await expect(bus.shutdown({ timeoutMs })).rejects.toBeInstanceOf(
        InvalidEventBusDrainTimeoutProblem,
      );
      await expect(bus.publish(new TestEvent("still-open"))).resolves.toBeUndefined();
    });

    it("integrates with ShutdownManager through the explicit shutdown hook adapter", async () => {
      const started = createDeferred();
      const release = createDeferred();

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          started.resolve();
          await release.promise;
        }
      }

      const bus = createTestEventBus<TestEvent>();
      Container.set(BlockingHandler, new BlockingHandler());
      bus.subscribe({ eventName: TestEvent.eventName, handlerClass: BlockingHandler });
      ShutdownManager.getInstance(1_000).register(
        createEventBusShutdownHook(bus, { timeoutMs: 500 }),
      );

      const publishPromise = bus.publish(new TestEvent("framework-shutdown"));
      await started.promise;
      const shutdownPromise = ShutdownManager.getInstance().shutdown({ throwOnHookError: true });

      let shutdownSettled = false;
      void shutdownPromise.then(() => {
        shutdownSettled = true;
      });
      await Promise.resolve();
      expect(shutdownSettled).toBe(false);

      release.resolve();
      await publishPromise;
      await expect(shutdownPromise).resolves.toBeUndefined();
      await expect(bus.publish(new TestEvent("closed"))).rejects.toBeInstanceOf(
        EventBusIntakeClosedProblem,
      );
    });
  });

  describe("memory leak prevention", () => {
    it("should clean up handler counter and not grow unbounded", async () => {
      const handlerCount = 100;

      class QuickHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await Promise.resolve();
        }
      }

      const bus = createTestEventBus<TestEvent>();

      Container.set(QuickHandler, new QuickHandler());
      bus.subscribe({ eventName: "TestEvent", handlerClass: QuickHandler });

      for (let i = 0; i < handlerCount; i++) {
        await bus.publish(new TestEvent(`event-${i}`));
      }

      expect(bus.getRunningHandlerCount()).toBe(0);
    });

    it("should release active handler references after settlement following clear", async () => {
      const started = createDeferred();
      const release = createDeferred();

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          started.resolve();
          await release.promise;
        }
      }

      const bus = createTestEventBus<TestEvent>({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      bus.subscribe({ eventName: "TestEvent", handlerClass: SlowHandler });

      const publishPromise = bus.publish(new TestEvent("slow"));

      await started.promise;
      expect(bus.getRunningHandlerCount()).toBe(1);

      bus.clear();

      expect(bus.getRunningHandlerCount()).toBe(1);

      release.resolve();
      await publishPromise;

      expect(bus.getRunningHandlerCount()).toBe(0);
    });
  });
});
