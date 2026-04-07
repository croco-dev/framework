import { DomainEvent, type EventHandler, type EventSubscription } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import * as telemetryApi from '@croco/telemetry-api';
import * as otelApi from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventPublishFailedError, InMemoryEventBus } from '../index';

class TestEvent extends DomainEvent {
  static readonly eventName = 'TestEvent';

  constructor(public readonly message: string) {
    super();
  }
}

class MutablePayloadEvent extends DomainEvent {
  static readonly eventName = 'MutablePayloadEvent';

  constructor(
    public payload: {
      nested: {
        count: number;
      };
    }
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
    throw new Error('Handler failed intentionally');
  }
}

describe('InMemoryEventBus', () => {
  let eventBus!: InMemoryEventBus;
  let testHandler!: TestHandler;

  beforeEach(() => {
    Container.reset();
    eventBus = new InMemoryEventBus();
    testHandler = new TestHandler();
    Container.reset();
  });

  describe('subscribe', () => {
    it('should subscribe a handler to an event', async () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription<TestEvent> = { eventName: 'TestEvent', handlerClass: TestHandler };
      eventBus.subscribe(subscription);

      const event = new TestEvent('subscribe-test');
      await eventBus.publish(event);
      expect(testHandler.handledEvents).toHaveLength(1);
      expect(testHandler.handledEvents[0].message).toBe('subscribe-test');
    });

    it('should allow multiple handlers for same event', async () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler1 });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler2 });

      const event = new TestEvent('multi-handler');
      await eventBus.publish(event);
      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });
  });

  describe('publish', () => {
    it('should publish event to subscribed handler', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });

      const event = new TestEvent('hello');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(1);
      expect(testHandler.handledEvents[0].message).toBe('hello');
    });

    it('should publish to multiple handlers', async () => {
      class Handler1 extends TestHandler {}
      class Handler2 extends TestHandler {}

      const handler1 = new Handler1();
      const handler2 = new Handler2();

      Container.set(Handler1, handler1);
      Container.set(Handler2, handler2);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler1 });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: Handler2 });

      const event = new TestEvent('broadcast');
      await eventBus.publish(event);

      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });

    describe('characterization', () => {
      it('should call subscribed handlers when publishing an event', async () => {
        class RecordingHandler implements EventHandler<TestEvent> {
          public readonly receivedMessages: string[] = [];

          async handle(event: TestEvent): Promise<void> {
            this.receivedMessages.push(event.message);
          }
        }

        const handler = new RecordingHandler();
        Container.set(RecordingHandler, handler);
        eventBus.subscribe({ eventName: 'TestEvent', handlerClass: RecordingHandler });

        await eventBus.publish(new TestEvent('characterization-single'));

        expect(handler.receivedMessages).toEqual(['characterization-single']);
      });

      it('should invoke multiple handlers in subscription order', async () => {
        const callSequence: string[] = [];

        class FirstHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push('first');
          }
        }

        class SecondHandler implements EventHandler<TestEvent> {
          async handle(): Promise<void> {
            callSequence.push('second');
          }
        }

        Container.set(FirstHandler, new FirstHandler());
        Container.set(SecondHandler, new SecondHandler());

        eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FirstHandler });
        eventBus.subscribe({ eventName: 'TestEvent', handlerClass: SecondHandler });

        await eventBus.publish(new TestEvent('characterization-order'));

        expect(callSequence).toEqual(['first', 'second']);
      });

      it('should log handler errors and continue with remaining handlers', async () => {
        class SuccessHandler extends TestHandler {}
        class FailHandler extends FailingHandler {}

        const successHandler = new SuccessHandler();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        Container.set(SuccessHandler, successHandler);
        Container.set(FailHandler, new FailHandler());

        eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailHandler });
        eventBus.subscribe({ eventName: 'TestEvent', handlerClass: SuccessHandler });

        await expect(eventBus.publish(new TestEvent('characterization-error'))).rejects.toMatchObject({
          eventName: 'TestEvent',
          failures: [
            expect.objectContaining({
              handlerName: 'FailHandler',
              error: expect.objectContaining({ message: 'Handler failed intentionally' }),
            }),
          ],
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'EventHandler error (TestEvent):',
          expect.objectContaining({ message: 'Handler failed intentionally' })
        );
        expect(successHandler.handledEvents).toHaveLength(1);

        consoleErrorSpy.mockRestore();
      });

      it('should deliver independent event copies to each handler', async () => {
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

        eventBus.subscribe({ eventName: MutablePayloadEvent.eventName, handlerClass: MutatingHandler });
        eventBus.subscribe({ eventName: MutablePayloadEvent.eventName, handlerClass: ObservingHandler });

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

    it('should not fail if no handlers subscribed', async () => {
      const event = new TestEvent('orphan');
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
    });

    it('should continue with other handlers if one fails', async () => {
      class SuccessHandler extends TestHandler {}
      class FailHandler extends FailingHandler {}

      const successHandler = new SuccessHandler();
      const failHandler = new FailHandler();

      Container.set(SuccessHandler, successHandler);
      Container.set(FailHandler, failHandler);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailHandler });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: SuccessHandler });

      const event = new TestEvent('test');
      await expect(eventBus.publish(event)).rejects.toMatchObject({
        eventName: 'TestEvent',
        failures: [
          expect.objectContaining({
            handlerName: 'FailHandler',
            error: expect.objectContaining({ message: 'Handler failed intentionally' }),
          }),
        ],
      });
      expect(successHandler.handledEvents).toHaveLength(1);
    });

    it('should not mutate original event metadata when publishing same event twice', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });

      const event = new TestEvent('immutable');
      const originalMetadata = event.metadata;

      await eventBus.publish(event);
      await eventBus.publish(event);

      expect(event.metadata).toEqual({});
      expect(event.metadata).toBe(originalMetadata);
    });

    it('should isolate traceContext between publishes when same event instance is reused', async () => {
      class TraceContextMutatingHandler implements EventHandler<TestEvent> {
        public readonly traceContextSpanIds: string[] = [];

        async handle(event: TestEvent): Promise<void> {
          const { traceContext } = event.metadata;
          const spanId = traceContext?.spanId;
          if (traceContext && spanId) {
            this.traceContextSpanIds.push(spanId);
            traceContext.spanId = 'mutated-by-handler';
          }
        }
      }

      const handler = new TraceContextMutatingHandler();
      Container.set(TraceContextMutatingHandler, handler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TraceContextMutatingHandler });

      const sharedTraceContext = {
        traceId: 'trace-1',
        spanId: 'span-1',
        traceFlags: 1,
        isValid: true,
      };
      const traceInfoSpy = vi.spyOn(telemetryApi, 'getActiveTraceInfo').mockReturnValue(sharedTraceContext);

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
            callback: (span: typeof publishSpan) => Promise<void>
          ) => {
            const span = name.startsWith('event.publish:') ? publishSpan : handleSpan;
            await callback(span);
          }
        ),
      };

      Object.defineProperty(eventBus, 'tracer', {
        value: mockTracer,
      });

      const event = new TestEvent('trace-context-copy');
      await eventBus.publish(event);
      await eventBus.publish(event);

      expect(handler.traceContextSpanIds).toEqual(['span-1', 'span-1']);
      expect(sharedTraceContext.spanId).toBe('span-1');
      traceInfoSpy.mockRestore();
    });

    it('should restore trace context before starting handler spans', async () => {
      const handler = new TestHandler();
      Container.set(TestHandler, handler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });

      const traceInfoSpy = vi.spyOn(telemetryApi, 'getActiveTraceInfo').mockReturnValue({
        traceId: '0123456789abcdef0123456789abcdef',
        spanId: '0123456789abcdef',
        traceFlags: 1,
        isValid: true,
      });

      const contextWithSpy = vi.spyOn(otelApi.context, 'with');
      const setSpanContextSpy = vi.spyOn(otelApi.trace, 'setSpanContext');

      await eventBus.publish(new TestEvent('restore-trace-context'));

      expect(setSpanContextSpy).toHaveBeenCalledWith(expect.anything(), {
        traceId: '0123456789abcdef0123456789abcdef',
        spanId: '0123456789abcdef',
        traceFlags: 1,
        isRemote: true,
      });
      expect(contextWithSpy).toHaveBeenCalled();

      traceInfoSpy.mockRestore();
      contextWithSpy.mockRestore();
      setSpanContextSpy.mockRestore();
    });

    it('should pass Error object to recordException', async () => {
      const failHandler = new FailingHandler();
      Container.set(FailingHandler, failHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailingHandler });

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
            callback: (span: typeof publishSpan) => Promise<void>
          ) => {
            const span = name.startsWith('event.publish:') ? publishSpan : handleSpan;
            await callback(span);
          }
        ),
      };

      Object.defineProperty(eventBus, 'tracer', {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent('record-error'))).rejects.toThrow(EventPublishFailedError);

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should preserve error stack when recording exception', async () => {
      const expectedError = new Error('stack-preserve-target');

      class StackFailingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          throw expectedError;
        }
      }

      const failHandler = new StackFailingHandler();
      Container.set(StackFailingHandler, failHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: StackFailingHandler });

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
            callback: (span: typeof publishSpan) => Promise<void>
          ) => {
            const span = name.startsWith('event.publish:') ? publishSpan : handleSpan;
            await callback(span);
          }
        ),
      };

      Object.defineProperty(eventBus, 'tracer', {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent('record-stack-error'))).rejects.toThrow(EventPublishFailedError);

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException).toHaveBeenCalledWith(expectedError);
      expect((handleSpan.recordException.mock.calls[0][0] as Error).stack).toBe(expectedError.stack);
    });

    it('should mark publish span as error when any handler fails', async () => {
      class SuccessHandler extends TestHandler {}
      class FailHandler extends FailingHandler {}

      const successHandler = new SuccessHandler();
      const failHandler = new FailHandler();

      Container.set(SuccessHandler, successHandler);
      Container.set(FailHandler, failHandler);

      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: FailHandler });
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: SuccessHandler });

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
            callback: (span: typeof publishSpan) => Promise<void>
          ) => {
            const span = name.startsWith('event.publish:') ? publishSpan : handleSpan;
            await callback(span);
          }
        ),
      };

      Object.defineProperty(eventBus, 'tracer', {
        value: mockTracer,
      });

      await expect(eventBus.publish(new TestEvent('status-check'))).rejects.toMatchObject({
        eventName: 'TestEvent',
        failures: [
          expect.objectContaining({
            handlerName: 'FailHandler',
            error: expect.objectContaining({ message: 'Handler failed intentionally' }),
          }),
        ],
      });

      expect(publishSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: '1 event handler(s) failed while publishing TestEvent',
      });
      expect(publishSpan.recordException).toHaveBeenCalledWith(expect.any(EventPublishFailedError));
      expect(successHandler.handledEvents).toHaveLength(1);
    });

    it('should isolate mutable payload between handlers in the same publish', async () => {
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

      eventBus.subscribe({ eventName: MutablePayloadEvent.eventName, handlerClass: MutatingHandler });
      eventBus.subscribe({ eventName: MutablePayloadEvent.eventName, handlerClass: ObservingHandler });

      const event = new MutablePayloadEvent({ nested: { count: 1 } });

      await eventBus.publish(event);

      expect(event.payload.nested.count).toBe(1);
      expect(event.metadata).toEqual({});
      expect(observingHandler.observedCounts).toEqual([1]);
      expect(observingHandler.observedMetadata).toHaveLength(1);
      expect(observingHandler.observedMetadata[0]).not.toHaveProperty('custom');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe a handler', async () => {
      Container.set(TestHandler, testHandler);
      const subscription: EventSubscription<TestEvent> = { eventName: 'TestEvent', handlerClass: TestHandler };

      eventBus.subscribe(subscription);
      eventBus.unsubscribe(subscription);

      const event = new TestEvent('after-unsubscribe');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it('should not fail when unsubscribing non-existent handler', () => {
      const subscription: EventSubscription<TestEvent> = { eventName: 'TestEvent', handlerClass: TestHandler };
      expect(() => eventBus.unsubscribe(subscription)).not.toThrow();
    });

    it('should clean up running handlers on unsubscribe', async () => {
      class SlowHandler implements EventHandler<TestEvent> {
        public static completeCount = 0;

        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
          SlowHandler.completeCount++;
        }
      }

      const limitedBus = new InMemoryEventBus({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      limitedBus.publish(new TestEvent('slow1'));
      limitedBus.publish(new TestEvent('slow2'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(limitedBus.getRunningHandlerCount()).toBe(1);

      limitedBus.unsubscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', async () => {
      Container.set(TestHandler, testHandler);
      eventBus.subscribe({ eventName: 'TestEvent', handlerClass: TestHandler });
      eventBus.clear();

      const event = new TestEvent('after-clear');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it('should clear running handlers', async () => {
      class SlowHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const limitedBus = new InMemoryEventBus({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      limitedBus.publish(new TestEvent('slow'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(limitedBus.getRunningHandlerCount()).toBe(1);

      limitedBus.clear();

      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });
  });

  describe('backpressure', () => {
    it('should respect maxConcurrency with block strategy', async () => {
      const executionOrder: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionOrder.push(`start-${event.message}`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          executionOrder.push(`end-${event.message}`);
        }
      }

      const limitedBus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1, backpressureStrategy: 'block' });

      Container.set(SlowHandler, new SlowHandler());
      limitedBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      await Promise.all([
        limitedBus.publish(new TestEvent('first')),
        limitedBus.publish(new TestEvent('second')),
        limitedBus.publish(new TestEvent('third')),
      ]);

      expect(executionOrder).toEqual([
        'start-first',
        'end-first',
        'start-second',
        'end-second',
        'start-third',
        'end-third',
      ]);
    });

    it('should drop events when using drop strategy', async () => {
      const executionCount: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionCount.push(event.message);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const dropBus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1, backpressureStrategy: 'drop' });

      Container.set(SlowHandler, new SlowHandler());
      dropBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      const promise1 = dropBus.publish(new TestEvent('first'));
      const promise2 = dropBus.publish(new TestEvent('second'));
      const promise3 = dropBus.publish(new TestEvent('third'));

      await Promise.all([promise1, promise2, promise3]);

      expect(executionCount).toHaveLength(1);
      expect(executionCount[0]).toBe('first');
    });

    it('should throw error when using error strategy', async () => {
      class SlowHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const errorBus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1, backpressureStrategy: 'error' });

      Container.set(SlowHandler, new SlowHandler());
      errorBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      const promise1 = errorBus.publish(new TestEvent('first'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(errorBus.publish(new TestEvent('second'))).rejects.toThrow('Backpressure exceeded');

      await promise1;
    });

    it('should track running handlers correctly', async () => {
      let resolveHandler: (() => void) | undefined;

      class BlockingHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise<void>((resolve) => {
            resolveHandler = resolve;
          });
        }
      }

      const limitedBus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1 });

      Container.set(BlockingHandler, new BlockingHandler());
      limitedBus.subscribe({ eventName: 'TestEvent', handlerClass: BlockingHandler });

      const publishPromise = limitedBus.publish(new TestEvent('block'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(limitedBus.getRunningHandlerCount()).toBe(1);
      expect(limitedBus.getRunningHandlers()).toHaveLength(1);
      expect(limitedBus.getRunningHandlers()[0].eventName).toBe('TestEvent');
      expect(limitedBus.getRunningHandlers()[0].handlerName).toBe('BlockingHandler');

      resolveHandler?.();
      await publishPromise;

      expect(limitedBus.getRunningHandlerCount()).toBe(0);
    });

    it('should allow unlimited concurrency by default', async () => {
      const executionOrder: string[] = [];

      class SlowHandler implements EventHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
          executionOrder.push(`start-${event.message}`);
          await new Promise((resolve) => setTimeout(resolve, 20));
          executionOrder.push(`end-${event.message}`);
        }
      }

      const unlimitedBus = new InMemoryEventBus<TestEvent>();

      Container.set(SlowHandler, new SlowHandler());
      unlimitedBus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      await Promise.all([
        unlimitedBus.publish(new TestEvent('first')),
        unlimitedBus.publish(new TestEvent('second')),
        unlimitedBus.publish(new TestEvent('third')),
      ]);

      const starts = executionOrder.filter((e) => e.startsWith('start-'));
      expect(starts).toHaveLength(3);
    });
  });

  describe('memory leak prevention', () => {
    it('should clean up handler counter and not grow unbounded', async () => {
      const handlerCount = 100;

      class QuickHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await Promise.resolve();
        }
      }

      const bus = new InMemoryEventBus<TestEvent>();

      Container.set(QuickHandler, new QuickHandler());
      bus.subscribe({ eventName: 'TestEvent', handlerClass: QuickHandler });

      for (let i = 0; i < handlerCount; i++) {
        await bus.publish(new TestEvent(`event-${i}`));
      }

      expect(bus.getRunningHandlerCount()).toBe(0);
    });

    it('should release all references on clear', async () => {
      class SlowHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const bus = new InMemoryEventBus<TestEvent>({ maxConcurrency: 1 });

      Container.set(SlowHandler, new SlowHandler());
      bus.subscribe({ eventName: 'TestEvent', handlerClass: SlowHandler });

      const publishPromise = bus.publish(new TestEvent('slow'));

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(bus.getRunningHandlerCount()).toBe(1);

      bus.clear();

      expect(bus.getRunningHandlerCount()).toBe(0);

      await publishPromise;

      expect(bus.getRunningHandlerCount()).toBe(0);
    });
  });
});
