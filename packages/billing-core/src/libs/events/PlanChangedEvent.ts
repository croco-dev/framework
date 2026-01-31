import { DomainEvent } from '@croco/events-core';

export class PlanChangedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly previousPlanId: string,
    public readonly newPlanId: string,
    public readonly externalSubscriptionId: string
  ) {
    super();
  }
}
