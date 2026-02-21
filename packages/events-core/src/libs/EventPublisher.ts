import type { DomainEvent } from './DomainEvent';
import { EventBusConfig } from './EventBusConfig';

export type PublishResult<T extends DomainEvent> = {
  event: T;
  success: boolean;
  error?: Error;
};

export class EventPublisher {
  private get eventBus() {
    return EventBusConfig.getInstance().getEventBus();
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }

  async publishMany(events: DomainEvent[]): Promise<PublishResult<DomainEvent>[]> {
    const results: PublishResult<DomainEvent>[] = [];
    for (const event of events) {
      try {
        await this.publish(event);
        results.push({ event, success: true });
      } catch (error) {
        results.push({ event, success: false, error: error as Error });
      }
    }
    return results;
  }

  async publishManyParallel(events: DomainEvent[]): Promise<PublishResult<DomainEvent>[]> {
    const results = await Promise.all(
      events.map(async (event): Promise<PublishResult<DomainEvent>> => {
        try {
          await this.publish(event);
          return { event, success: true };
        } catch (error) {
          return { event, success: false, error: error as Error };
        }
      })
    );
    return results;
  }
}
