import type { DomainEvent, EventBus, EventHandlerClass, EventSubscription } from '@croco/events-core';
import { EventSubscriptionIndex } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TraceInfo } from '@croco/telemetry-api';
import { getActiveTraceInfo, getTracer } from '@croco/telemetry-api';
import { type Context, context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { BackpressureExceededProblem } from './problems/EventsInmemoryProblems';

export type EventPublishFailure = {
  handlerName: string;
  error: Error;
};

export class EventPublishFailedError extends Error {
  readonly name = 'EventPublishFailedError';
  readonly cause?: Error;

  constructor(
    readonly eventName: string,
    readonly failures: EventPublishFailure[]
  ) {
    super(`${failures.length} event handler(s) failed while publishing ${eventName}`);
    this.cause = failures[0]?.error;
  }
}

export class InvalidEventBusConfigurationError extends Error {
  readonly name = 'InvalidEventBusConfigurationError';

  constructor(message: string) {
    super(`Invalid EventBus configuration: ${message}`);
  }
}

export type BackpressureStrategy = 'drop' | 'block' | 'error';

export type InMemoryEventBusOptions = {
  maxConcurrency?: number;
  backpressureStrategy?: BackpressureStrategy;
};

type RunningHandler = {
  eventName: string;
  handlerName: string;
  startTime: number;
};

export class InMemoryEventBus<TEvent extends DomainEvent = DomainEvent> implements EventBus<TEvent> {
  private readonly index = new EventSubscriptionIndex<EventHandlerClass<TEvent>>();
  private readonly tracer = getTracer();
  private readonly maxConcurrency: number;
  private readonly backpressureStrategy: BackpressureStrategy;
  private runningHandlers = new Map<string, RunningHandler>();
  private handlerCounter = 0;

  constructor(options: InMemoryEventBusOptions = {}) {
    const maxConcurrency = options.maxConcurrency ?? 100;
    if (!Number.isFinite(maxConcurrency) || maxConcurrency <= 0) {
      throw new InvalidEventBusConfigurationError(
        `maxConcurrency must be a positive finite number, got ${maxConcurrency}`
      );
    }
    this.maxConcurrency = maxConcurrency;
    this.backpressureStrategy = options.backpressureStrategy ?? 'block';
  }

  async publish(event: TEvent): Promise<void> {
    const eventName = event.eventName;
    const traceInfo = getActiveTraceInfo();
    const baseEvent = this.createEventWithTraceContext(event, traceInfo);
    const handlerClasses = this.resolveSubscribers(eventName);

    await this.tracer.startActiveSpan(
      `event.publish:${eventName}`,
      { attributes: this.createPublishSpanAttributes(event, traceInfo) },
      async (publishSpan: Span) => this.finishPublishSpan(publishSpan, handlerClasses, baseEvent, eventName)
    );
  }

  private async finishPublishSpan(
    publishSpan: Span,
    handlerClasses: EventHandlerClass<TEvent>[],
    baseEvent: TEvent,
    eventName: string
  ): Promise<void> {
    try {
      await this.executeWithBackpressure(handlerClasses, baseEvent, eventName);
      publishSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      publishSpan.recordException(normalizedError);
      publishSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: normalizedError.message,
      });
      throw normalizedError;
    } finally {
      publishSpan.end();
    }
  }

  private async executeWithBackpressure(
    handlerClasses: EventHandlerClass<TEvent>[],
    baseEvent: TEvent,
    eventName: string
  ): Promise<void> {
    if (this.maxConcurrency === Number.POSITIVE_INFINITY || handlerClasses.length === 0) {
      const results = await Promise.allSettled(
        handlerClasses.map((handlerClass) => this.executeSubscriber(handlerClass, baseEvent, eventName))
      );
      const failures = this.collectFailures(results, handlerClasses);
      if (failures.length > 0) {
        throw new EventPublishFailedError(eventName, failures);
      }
      return;
    }

    const currentRunning = this.runningHandlers.size;
    const availableSlots = this.maxConcurrency - currentRunning;

    if (availableSlots <= 0) {
      switch (this.backpressureStrategy) {
        case 'drop': {
          return;
        }
        case 'error': {
          throw new BackpressureExceededProblem(currentRunning);
        }
        case 'block':
        default: {
          await this.waitForSlot();
          return this.executeWithBackpressure(handlerClasses, baseEvent, eventName);
        }
      }
    }

    const handlersToRun = handlerClasses.slice(0, availableSlots);
    const remainingHandlers = handlerClasses.slice(availableSlots);

    const results = await Promise.allSettled(
      handlersToRun.map((handlerClass) => this.executeSubscriberWithTracking(handlerClass, baseEvent, eventName))
    );

    if (remainingHandlers.length > 0) {
      await this.waitForSlot();
      await this.executeWithBackpressure(remainingHandlers, baseEvent, eventName);
    }

    const failures = this.collectFailures(results, handlersToRun);
    if (failures.length > 0) {
      throw new EventPublishFailedError(eventName, failures);
    }
  }

  private async waitForSlot(): Promise<void> {
    if (this.runningHandlers.size === 0) {
      return;
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.runningHandlers.size < this.maxConcurrency) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });
  }

  private async executeSubscriberWithTracking(
    handlerClass: EventHandlerClass<TEvent>,
    baseEvent: TEvent,
    eventName: string
  ): Promise<EventPublishFailure | null> {
    const handlerName = handlerClass.name;
    const handlerId = `${handlerName}-${++this.handlerCounter}`;
    const startTime = Date.now();

    this.runningHandlers.set(handlerId, { eventName, handlerName, startTime });

    try {
      return await this.executeSubscriber(handlerClass, baseEvent, eventName);
    } finally {
      this.runningHandlers.delete(handlerId);
    }
  }

  private collectFailures(
    results: PromiseSettledResult<EventPublishFailure | null>[],
    handlerClasses: EventHandlerClass<TEvent>[]
  ): EventPublishFailure[] {
    return results.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value ? [result.value] : [];
      }

      return [
        {
          handlerName: handlerClasses[index]?.name ?? 'UnknownHandler',
          error: this.normalizeError(result.reason),
        },
      ];
    });
  }

  private createPublishSpanAttributes(event: TEvent, traceInfo: TraceInfo): Record<string, boolean | number | string> {
    return {
      'event.name': event.eventName,
      'event.timestamp': event.timestamp.toISOString(),
      'trace.id': traceInfo.traceId ?? '',
      'trace.span_id': traceInfo.spanId ?? '',
      'trace.is_valid': traceInfo.isValid ?? false,
    };
  }

  private resolveSubscribers(eventName: string): EventHandlerClass<TEvent>[] {
    return Array.from(this.index.match(eventName));
  }

  private async executeSubscriber(
    handlerClass: EventHandlerClass<TEvent>,
    baseEvent: TEvent,
    eventName: string
  ): Promise<EventPublishFailure | null> {
    const handlerName = handlerClass.name;
    const parentContext = this.createParentContext(baseEvent.metadata.traceContext);
    let failure: EventPublishFailure | null = null;

    await context.with(parentContext, async () => {
      await this.tracer.startActiveSpan(
        `event.handle:${handlerName}`,
        {
          attributes: {
            'event.name': eventName,
            'handler.name': handlerName,
            'handler.type': 'consumer',
          },
        },
        async (handleSpan: Span) => {
          try {
            const handlerInstance = Container.get(handlerClass);
            const handlerEvent = this.cloneEvent(baseEvent);
            await handlerInstance.handle(handlerEvent);
            handleSpan.setStatus({ code: SpanStatusCode.OK });
          } catch (error) {
            const normalizedError = this.normalizeError(error);
            failure = {
              handlerName,
              error: normalizedError,
            };
            handleSpan.recordException(normalizedError);
            handleSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: normalizedError.message,
            });

            try {
              const logger = Container.get(Logger);
              logger.error(`EventHandler error (${eventName}):`, normalizedError);
            } catch {
              console.error(`EventHandler error (${eventName}):`, normalizedError);
            }
          } finally {
            handleSpan.end();
          }
        }
      );
    });

    return failure;
  }

  private createEventWithTraceContext(event: TEvent, traceContext: TraceInfo): TEvent {
    const eventCopy = this.cloneEvent(event);
    const traceContextCopy = { ...traceContext };
    eventCopy.metadata = {
      ...eventCopy.metadata,
      traceContext: traceContextCopy,
    };

    return eventCopy;
  }

  private createParentContext(traceContext: TEvent['metadata']['traceContext']): Context {
    if (!traceContext?.isValid || !traceContext.traceId || !traceContext.spanId) {
      return context.active();
    }

    return trace.setSpanContext(context.active(), {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      traceFlags: traceContext.traceFlags ?? 0,
      isRemote: true,
    });
  }

  private cloneEvent(event: TEvent): TEvent {
    const clonedEvent = Object.create(Object.getPrototypeOf(event)) as TEvent;
    Object.assign(clonedEvent, this.cloneValue({ ...event }));

    return clonedEvent;
  }

  private cloneValue<T>(value: T): T {
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.cloneValue(item)) as T;
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    const clonedEntries = Object.entries(value).map(([key, entryValue]) => [key, this.cloneValue(entryValue)]);

    return Object.fromEntries(clonedEntries) as T;
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  subscribe(subscription: EventSubscription<TEvent>): void {
    this.index.add(subscription.eventName, subscription.handlerClass);
  }

  unsubscribe(subscription: EventSubscription<TEvent>): void {
    this.index.delete(subscription.eventName, subscription.handlerClass);
    this.cleanupRunningHandlers(subscription.eventName, subscription.handlerClass.name);
  }

  private cleanupRunningHandlers(eventName: string, handlerName: string): void {
    for (const [id, runningHandler] of this.runningHandlers.entries()) {
      if (runningHandler.eventName === eventName && runningHandler.handlerName === handlerName) {
        this.runningHandlers.delete(id);
      }
    }
  }

  clear(): void {
    this.index.clear();
    this.runningHandlers.clear();
    this.handlerCounter = 0;
  }

  getRunningHandlerCount(): number {
    return this.runningHandlers.size;
  }

  getRunningHandlers(): ReadonlyArray<RunningHandler> {
    return Array.from(this.runningHandlers.values());
  }
}
