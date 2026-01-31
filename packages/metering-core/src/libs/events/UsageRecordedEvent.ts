import { DomainEvent } from '@croco/events-core';

export class UsageRecordedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly value: number,
    public readonly idempotencyKey: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super();
  }
}
