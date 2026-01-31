import { DomainEvent } from '@croco/events-core';

export class SubscriptionCanceledEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string,
    public readonly cancelAtPeriodEnd: boolean
  ) {
    super();
  }
}
