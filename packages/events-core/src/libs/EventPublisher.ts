import { Container, TRANSACTION_CONTEXT_TOKEN, type TransactionContext } from '@croco/framework-context';
import type { DomainEvent } from './DomainEvent';
import type { EventBusConfig } from './EventBusConfig';
import { EventTransactionContextUnavailableProblem } from './problems/EventsProblems';

export type PublishResult<T extends DomainEvent> = {
  event: T;
  success: boolean;
  error?: Error;
};

export class EventPublisher {
  constructor(private readonly config: EventBusConfig) {}

  private tryGetTransactionContext(): TransactionContext | null {
    if (!Container.has(TRANSACTION_CONTEXT_TOKEN)) {
      return null;
    }

    try {
      return Container.get<TransactionContext>(TRANSACTION_CONTEXT_TOKEN);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EventTransactionContextUnavailableProblem(message);
    }
  }

  private get eventBus() {
    return this.config.getEventBus();
  }

  async publish(event: DomainEvent): Promise<void> {
    const txContext = this.tryGetTransactionContext();
    if (txContext?.isInTransaction()) {
      txContext.onAfterCommit(() => this.eventBus.publish(event));
    } else {
      await this.eventBus.publish(event);
    }
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
