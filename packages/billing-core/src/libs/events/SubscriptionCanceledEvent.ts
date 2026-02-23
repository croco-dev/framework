import { DomainEvent } from '@croco/events-core';

export class SubscriptionCanceledEvent extends DomainEvent {
  static readonly eventName = 'billing.subscription_canceled';
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string,
    public readonly cancelAtPeriodEnd: boolean
  ) {
    super();
  }
}
