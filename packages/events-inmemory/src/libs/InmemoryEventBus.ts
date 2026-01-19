import { EventBus, EventSubscription, DomainEvent, EventHandlerClass } from '@croco/events-core';
import { Container } from '@croco/framework-context';

export class InMemoryEventBus implements EventBus {
  private readonly handlers: Map<string, Set<EventHandlerClass>> = new Map();

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.eventName;
    const handlerClasses = this.handlers.get(eventName) ?? new Set();

    await Promise.allSettled(
      Array.from(handlerClasses).map(async handlerClass => {
        try {
          const handlerInstance = Container.get(handlerClass);
          await handlerInstance.handle(event);
        } catch (error) {
          console.error(`❌ EventHandler 실행 중 오류 (${eventName}):`, error);
        }
      })
    );
  }

  subscribe(subscription: EventSubscription): void {
    if (!this.handlers.has(subscription.eventName)) {
      this.handlers.set(subscription.eventName, new Set());
    }

    const handlers = this.handlers.get(subscription.eventName)!;
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
