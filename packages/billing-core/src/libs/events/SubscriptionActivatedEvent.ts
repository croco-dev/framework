import { DomainEvent } from "@croco/events-core";

export class SubscriptionActivatedEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_activated";
  static fromPayload(payload: Record<string, unknown>): SubscriptionActivatedEvent {
    return new SubscriptionActivatedEvent(
      payload.tenantId as string,
      payload.planId as string,
      payload.externalSubscriptionId as string,
    );
  }

  constructor(
    public readonly tenantId: string,
    public readonly planId: string,
    public readonly externalSubscriptionId: string,
  ) {
    super();
  }
}
