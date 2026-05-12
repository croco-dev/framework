import { DomainEvent } from "@croco/events-core";

export class EntitlementDeniedEvent extends DomainEvent {
  public static eventName = "entitlement.denied";

  constructor(
    public readonly tenantId: string,
    public readonly featureKey: string,
    public readonly reason: string,
  ) {
    super();
  }
}

export class EntitlementQuotaExceededEvent extends DomainEvent {
  public static eventName = "entitlement.quota.exceeded";

  constructor(
    public readonly tenantId: string,
    public readonly featureKey: string,
    public readonly usage: number,
    public readonly quota: number,
  ) {
    super();
  }
}

export class EntitlementOverageAllowedEvent extends DomainEvent {
  public static eventName = "entitlement.overage.allowed";

  constructor(
    public readonly tenantId: string,
    public readonly featureKey: string,
    public readonly usage: number,
    public readonly quota: number,
    public readonly planId: string,
  ) {
    super();
  }
}
