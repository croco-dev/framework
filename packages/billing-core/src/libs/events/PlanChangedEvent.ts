import { DomainEvent } from "@croco/events-core";
import type { PlanVersionRef } from "../../types";

export class PlanChangedEvent extends DomainEvent {
  static readonly eventName = "billing.plan_changed";
  static fromPayload(payload: Record<string, unknown>): PlanChangedEvent {
    return new PlanChangedEvent(
      payload.tenantId as string,
      payload.previousPlanId as string,
      payload.newPlanId as string,
      payload.externalSubscriptionId as string,
      payload.previousPlanVersionRef as PlanVersionRef,
      payload.newPlanVersionRef as PlanVersionRef,
    );
  }

  constructor(
    public readonly tenantId: string,
    public readonly previousPlanId: string,
    public readonly newPlanId: string,
    public readonly externalSubscriptionId: string,
    public readonly previousPlanVersionRef: PlanVersionRef,
    public readonly newPlanVersionRef: PlanVersionRef,
  ) {
    super();
  }
}
