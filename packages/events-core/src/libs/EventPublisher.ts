import type { DomainEvent } from './DomainEvent';
import { EventBusConfig } from './EventBusConfig';

export class EventPublisher {
  private get eventBus() {
    return EventBusConfig.getInstance().getEventBus();
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEventSafely(event);
    }
  }

  async publishManyParallel(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.publishEventSafely(event)));
  }

  private async publishEventSafely(event: DomainEvent): Promise<void> {
    try {
      await this.eventBus.publish(event);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish event: ${event.eventName}`, error);
    }
  }
}
