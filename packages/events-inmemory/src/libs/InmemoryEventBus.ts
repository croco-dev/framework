import type { DomainEvent, EventBus, EventHandlerClass, EventSubscription } from '@croco/events-core';
import { EventSubscriptionIndex } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TraceInfo } from '@croco/telemetry-api';
import { getActiveTraceInfo, getTracer } from '@croco/telemetry-api';
import { type Context, context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';

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

export class InMemoryEventBus implements EventBus {
  private readonly index = new EventSubscriptionIndex<EventHandlerClass>();
  private readonly tracer = getTracer();

  async publish(event: DomainEvent): Promise<void> {
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
    handlerClasses: EventHandlerClass[],
    baseEvent: DomainEvent,
    eventName: string
  ): Promise<void> {
    try {
      const results = await Promise.allSettled(
        handlerClasses.map((handlerClass) => this.executeSubscriber(handlerClass, baseEvent, eventName))
      );
      const failures = results.flatMap((result, index) => {
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

      if (failures.length > 0) {
        throw new EventPublishFailedError(eventName, failures);
      }

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

  private createPublishSpanAttributes(
    event: DomainEvent,
    traceInfo: TraceInfo
  ): Record<string, boolean | number | string> {
    return {
      'event.name': event.eventName,
      'event.timestamp': event.timestamp.toISOString(),
      'trace.id': traceInfo.traceId ?? '',
      'trace.span_id': traceInfo.spanId ?? '',
      'trace.is_valid': traceInfo.isValid ?? false,
    };
  }

  private resolveSubscribers(eventName: string): EventHandlerClass[] {
    return Array.from(this.index.match(eventName));
  }

  private async executeSubscriber(
    handlerClass: EventHandlerClass,
    baseEvent: DomainEvent,
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
              logger.error(`❌ EventHandler 실행 중 오류 (${eventName}):`, normalizedError);
            } catch {
              console.error(`❌ EventHandler 실행 중 오류 (${eventName}):`, normalizedError);
            }
          } finally {
            handleSpan.end();
          }
        }
      );
    });

    return failure;
  }

  private createEventWithTraceContext(event: DomainEvent, traceContext: TraceInfo): DomainEvent {
    const eventCopy = this.cloneEvent(event);
    const traceContextCopy = { ...traceContext };
    eventCopy.metadata = {
      ...eventCopy.metadata,
      traceContext: traceContextCopy,
    };

    return eventCopy;
  }

  private createParentContext(traceContext: DomainEvent['metadata']['traceContext']): Context {
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

  private cloneEvent(event: DomainEvent): DomainEvent {
    const clonedEvent = Object.create(Object.getPrototypeOf(event)) as DomainEvent;
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

  subscribe(subscription: EventSubscription): void {
    this.index.add(subscription.eventName, subscription.handlerClass);
  }

  unsubscribe(subscription: EventSubscription): void {
    this.index.delete(subscription.eventName, subscription.handlerClass);
  }

  clear(): void {
    this.index.clear();
  }
}
