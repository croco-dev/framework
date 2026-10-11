import { DomainEvent } from "@croco/events-core";
import type { PlanVersionRef } from "../../types";

export class SubscriptionRevokedEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_revoked";
  static fromPayload(payload: Record<string, unknown>): SubscriptionRevokedEvent {
    return new SubscriptionRevokedEvent(
      payload.tenantId as string,
      payload.externalSubscriptionId as string,
      payload.planVersionRef as PlanVersionRef | undefined,
    );
  }

  constructor(
    public readonly tenantId: string,
    public readonly externalSubscriptionId: string,
    public readonly planVersionRef?: PlanVersionRef,
  ) {
    super();
  }
}
