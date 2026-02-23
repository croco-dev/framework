import { DomainEvent } from '@croco/events-core';

export class SubscriptionPastDueEvent extends DomainEvent {
  static readonly eventName = 'billing.subscription_past_due';
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string
  ) {
    super();
  }
}
