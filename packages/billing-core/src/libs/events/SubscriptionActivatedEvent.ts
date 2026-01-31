import { DomainEvent } from '@croco/events-core';

export class SubscriptionActivatedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly planId: string,
    public readonly externalSubscriptionId: string
  ) {
    super();
  }
}
