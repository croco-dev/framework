import { DomainEvent } from "@croco/events-core";

export class SubscriptionPastDueEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_past_due";
  static fromPayload(payload: Record<string, unknown>): SubscriptionPastDueEvent {
    return new SubscriptionPastDueEvent(
      payload.tenantId as string,
      payload.externalSubscriptionId as string,
    );
  }

  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string,
  ) {
    super();
  }
}
