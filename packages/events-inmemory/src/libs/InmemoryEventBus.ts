import type { DomainEvent, EventBus, EventHandlerClass, EventSubscription } from '@croco/events-core';
import { EventSubscriptionIndex } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TraceInfo } from '@croco/telemetry-api';
import { getActiveTraceInfo, getTracer } from '@croco/telemetry-api';
import { type Span, SpanStatusCode } from '@opentelemetry/api';

export class InMemoryEventBus implements EventBus {
  private readonly index = new EventSubscriptionIndex<EventHandlerClass>();
  private readonly tracer = getTracer();

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.eventName;

    // PRODUCER: Capture active trace context and inject into event metadata
    const activeTraceInfo = getActiveTraceInfo();
    const eventWithTraceContext = this.createEventWithTraceContext(event, activeTraceInfo);

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
          await Promise.allSettled(
            Array.from(handlerClasses).map(async (handlerClass) => {
              const handlerName = handlerClass.name;

              // CONSUMER: Create child span for each handler
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
                    await handlerInstance.handle(eventWithTraceContext);
                    handleSpan.setStatus({ code: SpanStatusCode.OK });
                  } catch (error) {
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
            })
          );
          publishSpan.setStatus({ code: SpanStatusCode.OK });
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
    const eventCopy = Object.create(Object.getPrototypeOf(event)) as DomainEvent;
    Object.assign(eventCopy, event);
    const traceContextCopy = { ...traceContext };
    eventCopy.metadata = {
      ...event.metadata,
      traceContext: traceContextCopy,
    };

    return eventCopy;
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
