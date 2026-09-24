import type { TransactionContext } from "@croco/framework-context";
import type { DomainEvent } from "./DomainEvent";
import { EventBusConfig } from "./EventBusConfig";
import type { EventPublishOptions } from "./interfaces/EventPublishing";
import {
  EventAfterCommitOutcomeRequiredProblem,
  EventAfterCommitPublishFailedProblem,
  EventAfterCommitRequiresActiveTransactionProblem,
} from "./problems/EventsProblems";

export type PublishResult<T extends DomainEvent> = {
  event: T;
  success: boolean;
  error?: Error;
};

export type PublishAfterCommitOptions = {
  onPublished?: () => void;
  onError?: (error: Error) => void;
};

const UNKNOWN_PUBLICATION_FAILURE = "Unknown event publication failure";

function toError(error: unknown): Error {
  let nativeError: Error | undefined;
  try {
    nativeError = error instanceof Error ? error : undefined;
  } catch {
    nativeError = undefined;
  }
  if (nativeError) {
    return nativeError;
  }

  let message = UNKNOWN_PUBLICATION_FAILURE;
  try {
    message = String(error);
  } catch {
    message = UNKNOWN_PUBLICATION_FAILURE;
  }

  const normalizedError = new Error(message);
  Object.defineProperty(normalizedError, "cause", {
    configurable: true,
    enumerable: false,
    value: error,
    writable: true,
  });
  return normalizedError;
}

/**
 * 현재 EventBus 설정을 사용해 이벤트를 즉시 발행하거나 커밋 후 발행으로 예약합니다.
 */
export class EventPublisher {
  constructor(
    private readonly config: EventBusConfig,
    private readonly transactionContext?: TransactionContext,
  ) {}

  private get eventBus() {
    return this.config.getEventBus();
  }

  async publishNow(event: DomainEvent, options?: EventPublishOptions): Promise<void> {
    await this.eventBus.publish(event, options);
  }

  publishAfterCommit(event: DomainEvent, onPublished?: () => void): void;
  publishAfterCommit(event: DomainEvent, options?: PublishAfterCommitOptions): void;
  publishAfterCommit(
    event: DomainEvent,
    onPublishedOrOptions?: (() => void) | PublishAfterCommitOptions,
  ): void {
    const txContext = this.transactionContext;
    if (!txContext?.isInTransaction()) {
      throw new EventAfterCommitRequiresActiveTransactionProblem();
    }
    if (!txContext.canRegisterAfterCommit()) {
      throw new EventAfterCommitOutcomeRequiredProblem();
    }

    const options =
      typeof onPublishedOrOptions === "function"
        ? { onPublished: onPublishedOrOptions }
        : (onPublishedOrOptions ?? {});

    txContext.onAfterCommit(async () => {
      const eventBus = this.eventBus;
      try {
        await eventBus.publish(event);
      } catch (error) {
        if (eventBus.managesPublishStats !== true) {
          EventBusConfig.getStats()?.publish(true);
        }
        const publishError = toError(error);
        const failure = new EventAfterCommitPublishFailedProblem(event.eventName, publishError);
        try {
          options.onError?.(failure);
        } catch (observerError) {
          throw new EventAfterCommitPublishFailedProblem(
            event.eventName,
            publishError,
            toError(observerError),
          );
        }
        throw failure;
      }
      options.onPublished?.();
    });
  }

  async publishMany(events: DomainEvent[]): Promise<PublishResult<DomainEvent>[]> {
    const results: PublishResult<DomainEvent>[] = [];
    for (const event of events) {
      try {
        await this.publishNow(event);
        results.push({ event, success: true });
      } catch (error) {
        results.push({ event, success: false, error: toError(error) });
      }
    }
    return results;
  }

  async publishManyParallel(events: DomainEvent[]): Promise<PublishResult<DomainEvent>[]> {
    const results = await Promise.all(
      events.map(async (event): Promise<PublishResult<DomainEvent>> => {
        try {
          await this.publishNow(event);
          return { event, success: true };
        } catch (error) {
          return { event, success: false, error: toError(error) };
        }
      }),
    );
    return results;
  }
}
