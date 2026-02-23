import { DomainEvent } from '@croco/events-core';

export class OrderPaidEvent extends DomainEvent {
  static readonly eventName = 'billing.order_paid';
  constructor(
    public readonly tenantId: string,
    public readonly externalOrderId: string,
    public readonly amount: number,
    public readonly currency: string
  ) {
    super();
  }
}
