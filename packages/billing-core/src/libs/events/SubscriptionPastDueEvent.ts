import { DomainEvent } from '@croco/events-core';

export class SubscriptionPastDueEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string
  ) {
    super();
  }
}
