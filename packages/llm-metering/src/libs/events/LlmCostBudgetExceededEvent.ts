import { DomainEvent } from '@croco/events-core';

export class LlmCostBudgetExceededEvent extends DomainEvent {
  static eventName = 'llm.cost_budget_exceeded';
  constructor(
    public readonly tenantId: string,
    public readonly currentCost: number,
    public readonly limit: number,
    public readonly period: 'daily' | 'monthly'
  ) {
    super();
  }
}
