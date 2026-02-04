import type { DomainEvent, EventBus, EventHandlerClass, EventSubscription } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { getActiveTraceInfo, getTracer } from '@croco/telemetry-api';
import type { Span } from '@opentelemetry/api';

export class InMemoryEventBus implements EventBus {
  private readonly handlers: Map<string, Set<EventHandlerClass>> = new Map();
  private readonly tracer = getTracer();

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.eventName;

    // PRODUCER: Capture active trace context and inject into event metadata
    const activeTraceInfo = getActiveTraceInfo();
    event.metadata.traceContext = activeTraceInfo;

    const handlerClasses = this.handlers.get(eventName) ?? new Set();

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
                    await handlerInstance.handle(event);
                    handleSpan.setStatus({ code: 1 });
                  } catch (error) {
                    handleSpan.recordException(error instanceof Error ? error.message : String(error));
                    handleSpan.setStatus({
                      code: 2,
                      message: error instanceof Error ? error.message : String(error),
                    });

                    try {
                      const logger = Container.get(Logger);
                      logger.error(`❌ EventHandler 실행 중 오류 (${eventName}):`, error as Error);
                    } catch {
                      console.error(`❌ EventHandler 실행 중 오류 (${eventName}):`, error);
                    }
                  } finally {
                    handleSpan.end();
                  }
                }
              );
            })
          );
          publishSpan.setStatus({ code: 1 });
        } catch (error) {
          publishSpan.recordException(error instanceof Error ? error.message : String(error));
          publishSpan.setStatus({
            code: 2,
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          publishSpan.end();
        }
      }
    );
  }

  subscribe(subscription: EventSubscription): void {
    if (!this.handlers.has(subscription.eventName)) {
      this.handlers.set(subscription.eventName, new Set());
    }

    const handlers = this.handlers.get(subscription.eventName);
    if (!handlers) {
      throw new Error(`No handler set found for event: ${subscription.eventName}`);
    }
    handlers.add(subscription.handlerClass);
  }

  unsubscribe(subscription: EventSubscription): void {
    const handlers = this.handlers.get(subscription.eventName);
    if (handlers) {
      handlers.delete(subscription.handlerClass);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
