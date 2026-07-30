import { Component } from "@croco/framework-context";
import { SubscriptionProvider } from "./interfaces";
import { legacyPlanVersionRef } from "./EntitlementDefinition";
import type { SubscriptionPlanReference } from "./types";

@Component()
export class StaticSubscriptionProvider extends SubscriptionProvider {
  private readonly defaultPlan: SubscriptionPlanReference;

  constructor(defaultPlan: string | SubscriptionPlanReference) {
    super();
    this.defaultPlan =
      typeof defaultPlan === "string"
        ? {
            planId: defaultPlan,
            planVersionRef: legacyPlanVersionRef(defaultPlan),
          }
        : defaultPlan;
  }

  async getCurrentPlanId(_tenantId: string): Promise<string | null> {
    return this.defaultPlan.planId;
  }

  override async getCurrentPlanVersion(
    _tenantId: string,
  ): Promise<SubscriptionPlanReference | null> {
    return this.defaultPlan;
  }
}
