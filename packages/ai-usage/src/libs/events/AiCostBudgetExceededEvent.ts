import { DomainEvent } from "@croco/events-core";

export class AiCostBudgetExceededEvent extends DomainEvent {
  static eventName = "ai-usage/cost-budget-exceeded";
  constructor(
    public readonly tenantId: string,
    public readonly currentCost: number,
    public readonly limit: number,
    public readonly period: "daily" | "monthly",
  ) {
    super();
  }
}
