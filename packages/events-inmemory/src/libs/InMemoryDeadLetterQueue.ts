import type { DeadLetterItem, DeadLetterQueue, DomainEvent } from "@croco/events-core";
import { DEFAULT_DEAD_LETTER_POLICY } from "@croco/events-core";
import { InvalidDeadLetterQueueLimitProblem } from "./problems/EventsInmemoryProblems";

/**
 * A dead-letter entry returned by {@link InMemoryDeadLetterQueue}.
 * `itemId` identifies one event-and-handler entry for precise removal.
 */
export type InMemoryDeadLetterItem<TEvent extends DomainEvent = DomainEvent> =
  DeadLetterItem<TEvent> & {
    readonly itemId: string;
  };

function buildDeadLetterItemId(eventId: string, handlerId: string | undefined): string {
  const normalizedHandlerId = handlerId ?? "";
  return `${eventId.length}:${eventId}:${normalizedHandlerId.length}:${normalizedHandlerId}`;
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)]),
  ) as T;
}

function cloneItem<TEvent extends DomainEvent>(
  item: InMemoryDeadLetterItem<TEvent>,
): InMemoryDeadLetterItem<TEvent> {
  const event = Object.create(Object.getPrototypeOf(item.event)) as TEvent;
  Object.assign(event, cloneValue({ ...item.event }));

  return {
    ...item,
    event,
    failedAt: new Date(item.failedAt.getTime()),
    metadata: item.metadata ? cloneValue(item.metadata) : undefined,
  };
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Process-local dead-letter storage for tests, development, and single-process runtimes.
 * Entries are deduplicated by stable event and handler identity.
 */
export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  private readonly items = new Map<string, InMemoryDeadLetterItem>();

  async enqueue<TEvent extends DomainEvent>(item: DeadLetterItem<TEvent>): Promise<void> {
    const itemId = buildDeadLetterItemId(item.event.eventId, item.handlerId);
    this.items.set(itemId, cloneItem({ ...item, itemId }));
  }

  async dequeue<TEvent extends DomainEvent>(
    limit?: number,
  ): Promise<InMemoryDeadLetterItem<TEvent>[]> {
    this.validateLimit(limit);
    this.removeExpiredItems();
    const itemIds = Array.from(this.items.keys()).slice(0, limit);
    const dequeued: InMemoryDeadLetterItem<TEvent>[] = [];

    for (const itemId of itemIds) {
      const item = this.items.get(itemId);
      if (!item) {
        continue;
      }

      this.items.delete(itemId);
      dequeued.push(cloneItem(item) as InMemoryDeadLetterItem<TEvent>);
    }

    return dequeued;
  }

  async remove(itemId: string): Promise<void> {
    if (this.items.delete(itemId)) {
      return;
    }

    for (const [storedItemId, item] of this.items) {
      if (item.event.eventId === itemId) {
        this.items.delete(storedItemId);
      }
    }
  }

  async peek<TEvent extends DomainEvent>(): Promise<InMemoryDeadLetterItem<TEvent>[]> {
    this.removeExpiredItems();
    return Array.from(this.items.values(), (item) =>
      cloneItem(item),
    ) as InMemoryDeadLetterItem<TEvent>[];
  }

  async size(): Promise<number> {
    this.removeExpiredItems();
    return this.items.size;
  }

  async clear(): Promise<void> {
    this.items.clear();
  }

  private validateLimit(limit: number | undefined): void {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) {
      throw new InvalidDeadLetterQueueLimitProblem(limit);
    }
  }

  private removeExpiredItems(): void {
    const now = Date.now();
    for (const [itemId, item] of this.items) {
      const configuredRetention = item.metadata?.["retentionDays"];
      const retentionDays =
        typeof configuredRetention === "number" &&
        Number.isSafeInteger(configuredRetention) &&
        configuredRetention > 0
          ? configuredRetention
          : DEFAULT_DEAD_LETTER_POLICY.retentionDays;
      if (now - item.failedAt.getTime() >= retentionDays * MILLISECONDS_PER_DAY) {
        this.items.delete(itemId);
      }
    }
  }
}
