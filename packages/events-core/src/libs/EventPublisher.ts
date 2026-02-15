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
    const publishResults = await Promise.allSettled(events.map(async (event) => this.publishEventSafely(event)));
    this.logUnexpectedSettlementErrors(publishResults);
  }

  private async publishEventSafely(event: DomainEvent): Promise<void> {
    try {
      await this.eventBus.publish(event);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish event: ${event.eventName}`, error);
    }
  }

  private logUnexpectedSettlementErrors(results: PromiseSettledResult<void>[]): void {
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[EventPublisher] Unexpected publishMany settlement rejection', result.reason);
      }
    }
  }
}
