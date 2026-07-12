import type { EventHandler } from "@croco/events-core";
import { RegisterEventHandler } from "@croco/events-core";
import {
  Container,
  Context,
  type ILogger,
  LOGGER_TOKEN,
  MetadataStorage,
} from "@croco/framework-context";
import { SEARCHABLE_METADATA, type SearchableMetadata } from "../decorators/Searchable";
import { DocumentDeletedEvent, DocumentIndexedEvent, SearchSyncFailedEvent } from "../events";
import { SearchSyncIdentityConflictProblem } from "../problems/SearchProblems";

const SEARCH_SYNC_FAILED_EVENT_PUBLISH_ERROR_MESSAGE = "Failed to publish search sync failed event";

type SearchSyncFailedEventLogContext = {
  eventName: string;
  indexName: string;
  documentId: string;
  tenantId: string;
  operation: SearchSyncFailedEvent["operation"];
  syncErrorName: string;
  syncErrorMessage: string;
};

class LRUCache<T> {
  private cache = new Map<string, T>();

  constructor(private maxSize: number = 10000) {}

  has(key: string): boolean {
    return this.cache.has(key);
  }

  add(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

import { SearchEngine } from "../SearchEngine";

export type SearchSyncFailedEventPublisher = {
  publishNow(event: SearchSyncFailedEvent): Promise<void>;
};

@RegisterEventHandler(DocumentDeletedEvent)
@RegisterEventHandler(DocumentIndexedEvent)
export class SearchAutoSync implements EventHandler<DocumentIndexedEvent | DocumentDeletedEvent> {
  private processedEvents = new LRUCache<void>(10000);
  private readonly inFlightEvents = new Map<string, Promise<void>>();
  private readonly searchEngineToken = SearchEngine.token;

  constructor(private readonly failedEventPublisher?: SearchSyncFailedEventPublisher) {}

  async handle(event: DocumentIndexedEvent | DocumentDeletedEvent): Promise<void> {
    const metadata = this.getSearchableMetadata(event.indexName);
    if (!metadata || !metadata.autoSync) {
      return;
    }

    try {
      this.assertIdentity(event);
    } catch (error) {
      await this.publishSyncFailure(event, error);
      return;
    }

    const eventKey = `${event.eventId}:${event.eventName}:${event.indexName}:${event.documentId}:${event.tenantId}`;

    if (this.processedEvents.has(eventKey)) {
      return;
    }

    const inFlightEvent = this.inFlightEvents.get(eventKey);
    if (inFlightEvent) {
      await inFlightEvent;
      return;
    }

    const operation = this.process(event, eventKey);
    this.inFlightEvents.set(eventKey, operation);

    try {
      await operation;
    } finally {
      this.inFlightEvents.delete(eventKey);
    }
  }

  private async process(
    event: DocumentIndexedEvent | DocumentDeletedEvent,
    eventKey: string,
  ): Promise<void> {
    try {
      await this.sync(event);
      this.processedEvents.add(eventKey);
    } catch (error) {
      await this.publishSyncFailure(event, error);
    }
  }

  private assertIdentity(event: DocumentIndexedEvent | DocumentDeletedEvent): void {
    const ambientContext = Context.get();
    if (ambientContext?.tenantId !== undefined && ambientContext.tenantId !== event.tenantId) {
      throw new SearchSyncIdentityConflictProblem("context.tenantId");
    }

    if (event instanceof DocumentIndexedEvent) {
      this.assertPayloadIdentity(event.payload, "id", event.documentId, "payload.id");
      this.assertPayloadIdentity(event.payload, "tenantId", event.tenantId, "payload.tenantId");
    }
  }

  private async sync(event: DocumentIndexedEvent | DocumentDeletedEvent): Promise<void> {
    const ambientContext = Context.get();
    await Context.run(
      {
        ...ambientContext,
        requestId: ambientContext?.requestId ?? event.eventId,
        tenantId: event.tenantId,
      },
      async () => {
        const searchEngine = Container.get(this.searchEngineToken);

        if (event instanceof DocumentIndexedEvent) {
          await searchEngine.indexDocument(event.indexName, {
            ...event.payload,
            id: event.documentId,
            tenantId: event.tenantId,
          });
        } else {
          await searchEngine.deleteDocument(event.indexName, event.documentId);
        }
      },
    );
  }

  private assertPayloadIdentity(
    payload: Readonly<Record<string, unknown>>,
    field: "id" | "tenantId",
    expected: string,
    source: "payload.id" | "payload.tenantId",
  ): void {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== expected) {
      throw new SearchSyncIdentityConflictProblem(source);
    }
  }

  private async publishSyncFailure(
    event: DocumentIndexedEvent | DocumentDeletedEvent,
    error: unknown,
  ): Promise<void> {
    const failedEvent = new SearchSyncFailedEvent(
      event.indexName,
      event.documentId,
      event.tenantId,
      error instanceof Error ? error : new Error(String(error)),
      event instanceof DocumentIndexedEvent ? "index" : "delete",
    );

    await this.publishFailedEvent(failedEvent);
  }

  private async publishFailedEvent(event: SearchSyncFailedEvent): Promise<void> {
    if (!this.failedEventPublisher) {
      return;
    }

    try {
      await this.failedEventPublisher.publishNow(event);
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      this.reportFailedEventPublishError(event, normalizedError);
    }
  }

  private reportFailedEventPublishError(event: SearchSyncFailedEvent, error: Error): void {
    const logContext = this.createFailedEventLogContext(event);
    try {
      const logger = Container.get(LOGGER_TOKEN) as ILogger;
      logger
        .child({
          searchSyncFailedEvent: logContext,
        })
        .error(SEARCH_SYNC_FAILED_EVENT_PUBLISH_ERROR_MESSAGE, error);
    } catch {
      // Logger DI is unavailable; fallback to console.error so the error is not lost.
      // eslint-disable-next-line no-console
      console.error(
        SEARCH_SYNC_FAILED_EVENT_PUBLISH_ERROR_MESSAGE,
        { searchSyncFailedEvent: logContext },
        error,
      );
    }
  }

  private createFailedEventLogContext(
    event: SearchSyncFailedEvent,
  ): SearchSyncFailedEventLogContext {
    return {
      eventName: SearchSyncFailedEvent.eventName,
      indexName: event.indexName,
      documentId: event.documentId,
      tenantId: event.tenantId,
      operation: event.operation,
      syncErrorName: event.error.name,
      syncErrorMessage: event.error.message,
    };
  }

  private getSearchableMetadata(indexName: string): SearchableMetadata | undefined {
    const allMetadata = MetadataStorage.getAll<SearchableMetadata>(SEARCHABLE_METADATA);
    const entry = allMetadata.find((m) => m.value.index === indexName);
    return entry?.value;
  }
}
