import { DomainEvent } from './DomainEvent';
import { EventBusConfig } from './EventBusConfig';

export class EventPublisher {
  private readonly eventBus = EventBusConfig.getInstance().getEventBus();

  async publish(event: DomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }
}
