import { Component } from "@croco/framework-context";
import { SubscriptionProvider } from "./interfaces";

@Component()
export class StaticSubscriptionProvider extends SubscriptionProvider {
  constructor(private readonly defaultPlanId: string) {
    super();
  }

  async getCurrentPlanId(_tenantId: string): Promise<string | null> {
    return this.defaultPlanId;
  }
}
