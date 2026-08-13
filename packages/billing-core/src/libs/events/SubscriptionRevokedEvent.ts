import { DomainEvent } from "@croco/events-core";

export class SubscriptionRevokedEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_revoked";
  static fromPayload(payload: Record<string, unknown>): SubscriptionRevokedEvent {
    return new SubscriptionRevokedEvent(
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
