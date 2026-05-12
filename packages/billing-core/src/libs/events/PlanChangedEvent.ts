import { DomainEvent } from "@croco/events-core";

export class PlanChangedEvent extends DomainEvent {
  static readonly eventName = "billing.plan_changed";
  constructor(
    public readonly tenantId: string,
    public readonly previousPlanId: string,
    public readonly newPlanId: string,
    public readonly externalSubscriptionId: string,
  ) {
    super();
  }
}
