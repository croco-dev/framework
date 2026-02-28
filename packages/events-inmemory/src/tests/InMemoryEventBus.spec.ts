import { DomainEvent, type EventHandler, type EventSubscription } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import * as telemetryApi from '@croco/telemetry-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '../index';

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
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };
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
      await expect(eventBus.publish(event)).resolves.toBeUndefined();
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

      await eventBus.publish(new TestEvent('record-error'));

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

      await eventBus.publish(new TestEvent('record-stack-error'));

      expect(handleSpan.recordException).toHaveBeenCalledTimes(1);
      expect(handleSpan.recordException).toHaveBeenCalledWith(expectedError);
      expect((handleSpan.recordException.mock.calls[0][0] as Error).stack).toBe(expectedError.stack);
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
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };

      eventBus.subscribe(subscription);
      eventBus.unsubscribe(subscription);

      const event = new TestEvent('after-unsubscribe');
      await eventBus.publish(event);

      expect(testHandler.handledEvents).toHaveLength(0);
    });

    it('should not fail when unsubscribing non-existent handler', () => {
      const subscription: EventSubscription = { eventName: 'TestEvent', handlerClass: TestHandler };
      expect(() => eventBus.unsubscribe(subscription)).not.toThrow();
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
  });
});
