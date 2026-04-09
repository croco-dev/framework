import type { EventHandler } from '@croco/events-core';
import { RegisterEventHandler } from '@croco/events-core';
import { Container, MetadataStorage } from '@croco/framework-context';
import { SEARCHABLE_METADATA, type SearchableMetadata } from '../decorators/Searchable';
import { DocumentDeletedEvent, DocumentIndexedEvent, SearchSyncFailedEvent } from '../events';

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

import { SearchEngine } from '../SearchEngine';

export type SearchSyncFailedEventPublisher = {
  publish(event: SearchSyncFailedEvent): Promise<void>;
};

@RegisterEventHandler(DocumentDeletedEvent)
@RegisterEventHandler(DocumentIndexedEvent)
export class SearchAutoSync implements EventHandler<DocumentIndexedEvent | DocumentDeletedEvent> {
  private processedEvents = new LRUCache<void>(10000);
  private readonly searchEngineToken = SearchEngine.token;

  constructor(private readonly failedEventPublisher?: SearchSyncFailedEventPublisher) {}

  async handle(event: DocumentIndexedEvent | DocumentDeletedEvent): Promise<void> {
    const eventKey = `${event.eventName}:${event.indexName}:${event.documentId}:${event.tenantId}`;

    if (this.processedEvents.has(eventKey)) {
      return;
    }
    this.processedEvents.add(eventKey);

    const metadata = this.getSearchableMetadata(event.indexName);
    if (!metadata || !metadata.autoSync) {
      return;
    }

    try {
      const searchEngine = Container.get(this.searchEngineToken);

      if (event instanceof DocumentIndexedEvent) {
        await searchEngine.indexDocument(event.indexName, {
          id: event.documentId,
          tenantId: event.tenantId,
          ...event.payload,
        });
      } else if (event instanceof DocumentDeletedEvent) {
        await searchEngine.deleteDocument(event.indexName, event.documentId);
      }
    } catch (error) {
      const failedEvent = new SearchSyncFailedEvent(
        event.indexName,
        event.documentId,
        event.tenantId,
        error instanceof Error ? error : new Error(String(error)),
        event instanceof DocumentIndexedEvent ? 'index' : 'delete'
      );

      await this.publishFailedEvent(failedEvent);
    }
  }

  private async publishFailedEvent(event: SearchSyncFailedEvent): Promise<void> {
    if (!this.failedEventPublisher) {
      return;
    }

    try {
      await this.failedEventPublisher.publish(event);
    } catch {}
  }

  private getSearchableMetadata(indexName: string): SearchableMetadata | undefined {
    const allMetadata = MetadataStorage.getAll<SearchableMetadata>(SEARCHABLE_METADATA);
    const entry = allMetadata.find((m) => m.value.index === indexName);
    return entry?.value;
  }
}
