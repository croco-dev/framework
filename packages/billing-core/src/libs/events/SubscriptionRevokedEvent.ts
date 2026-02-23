import { DomainEvent } from '@croco/events-core';

export class SubscriptionRevokedEvent extends DomainEvent {
  static readonly eventName = 'billing.subscription_revoked';
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string
  ) {
    super();
  }
}
