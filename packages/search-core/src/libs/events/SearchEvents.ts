import { DomainEvent } from '@croco/events-core';

export class DocumentIndexedEvent extends DomainEvent {
  constructor(
    public readonly indexName: string,
    public readonly documentId: string,
    public readonly tenantId: string,
    public readonly payload: Record<string, unknown>
  ) {
    super();
  }
}

export class DocumentDeletedEvent extends DomainEvent {
  constructor(
    public readonly indexName: string,
    public readonly documentId: string,
    public readonly tenantId: string
  ) {
    super();
  }
}

export class SearchSyncFailedEvent extends DomainEvent {
  constructor(
    public readonly indexName: string,
    public readonly documentId: string,
    public readonly tenantId: string,
    public readonly error: Error,
    public readonly operation: 'index' | 'delete'
  ) {
    super();
  }
}
