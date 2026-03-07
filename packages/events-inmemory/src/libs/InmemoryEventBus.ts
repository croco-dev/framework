import type { DomainEvent, EventBus, EventHandlerClass, EventSubscription } from '@croco/events-core';
import { EventSubscriptionIndex } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TraceInfo } from '@croco/telemetry-api';
import { getActiveTraceInfo, getTracer } from '@croco/telemetry-api';
import { type Context, context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';

export class InMemoryEventBus implements EventBus {
  private readonly index = new EventSubscriptionIndex<EventHandlerClass>();
  private readonly tracer = getTracer();

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.eventName;

    // PRODUCER: Capture active trace context and inject into event metadata
    const activeTraceInfo = getActiveTraceInfo();
    const baseEvent = this.createEventWithTraceContext(event, activeTraceInfo);

    const handlerClasses = this.index.match(eventName);

    // PRODUCER: Create publish span
    await this.tracer.startActiveSpan(
      `event.publish:${eventName}`,
      {
        attributes: {
          'event.name': eventName,
          'event.timestamp': event.timestamp.toISOString(),
          'trace.id': activeTraceInfo.traceId ?? '',
          'trace.span_id': activeTraceInfo.spanId ?? '',
          'trace.is_valid': activeTraceInfo.isValid ?? false,
        },
      },
      async (publishSpan: Span) => {
        try {
          let hasHandlerFailure = false;

          await Promise.allSettled(
            Array.from(handlerClasses).map(async (handlerClass) => {
              const handlerName = handlerClass.name;
              const parentContext = this.createParentContext(baseEvent.metadata.traceContext);

              // CONSUMER: Create child span for each handler
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
                      hasHandlerFailure = true;
                      const normalizedError = this.normalizeError(error);
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
            })
          );

          if (hasHandlerFailure) {
            publishSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'One or more event handlers failed',
            });
          } else {
            publishSpan.setStatus({ code: SpanStatusCode.OK });
          }
        } catch (error) {
          const normalizedError = this.normalizeError(error);
          publishSpan.recordException(normalizedError);
          publishSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: normalizedError.message,
          });
        } finally {
          publishSpan.end();
        }
      }
    );
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
