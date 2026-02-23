import { DomainEvent } from '@croco/events-core';

export class QuotaExceededEvent extends DomainEvent {
  static eventName = 'metering.quota_exceeded';

  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly currentUsage: number,
    public readonly quota: number
  ) {
    super();
  }
}
