import { DomainEvent } from '@croco/events-core';

export class UsageRecordedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly value: number,
    public readonly idempotencyKey: string,
    metadata?: Record<string, unknown>
  ) {
    super();
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
  }
}
