import { DomainEvent } from "@croco/events-core";

export class SubscriptionCanceledEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_canceled";
  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string,
    public readonly cancelAtPeriodEnd: boolean,
    eventId?: string,
  ) {
    super();
    if (eventId) {
      const mutableEvent = this as unknown as { eventId: string };
      mutableEvent.eventId = eventId;
    }
  }
}
