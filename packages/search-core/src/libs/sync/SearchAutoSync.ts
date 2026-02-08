import { EventBusConfig, type EventHandler, RegisterEventHandler } from '@croco/events-core';
import { Container, MetadataStorage } from '@croco/framework-context';
import { SEARCHABLE_METADATA, type SearchableMetadata } from '../decorators/Searchable';
import { DocumentDeletedEvent, DocumentIndexedEvent, SearchSyncFailedEvent } from '../events';
import { SearchEngine } from '../SearchEngine';

@RegisterEventHandler(DocumentIndexedEvent)
export class SearchAutoSync implements EventHandler<DocumentIndexedEvent | DocumentDeletedEvent> {
  private processedEvents = new Set<string>();

  async handle(event: DocumentIndexedEvent | DocumentDeletedEvent): Promise<void> {
    const eventKey = `${event.eventName}:${event.indexName}:${event.documentId}:${event.tenantId}:${event.timestamp.getTime()}`;

    if (this.processedEvents.has(eventKey)) {
      return;
    }
    this.processedEvents.add(eventKey);

    const metadata = this.getSearchableMetadata(event.indexName);
    if (!metadata || !metadata.autoSync) {
      return;
    }

    try {
      // biome-ignore lint/suspicious/noExplicitAny: Token support
      const searchEngine = Container.get(SearchEngine.token as any) as SearchEngine;

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

      await EventBusConfig.getInstance().getEventBus()?.publish(failedEvent);
    }
  }

  private getSearchableMetadata(indexName: string): SearchableMetadata | undefined {
    const allMetadata = MetadataStorage.getAll<SearchableMetadata>(SEARCHABLE_METADATA);
    const entry = allMetadata.find((m) => m.value.index === indexName);
    return entry?.value;
  }
}
