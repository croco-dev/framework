import { Component } from '@croco/framework-context';
import { PlanEntitlementRegistry } from './interfaces';
import type { EntitlementRule } from './types';

@Component()
export class InMemoryPlanEntitlementRegistry extends PlanEntitlementRegistry {
  private readonly registry = new Map<string, EntitlementRule[]>();

  register(planId: string, rules: EntitlementRule[]): void {
    this.registry.set(planId, rules);
  }

  clear(): void {
    this.registry.clear();
  }

  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    return this.registry.get(planId) ?? [];
  }

  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    const rules = this.registry.get(planId);
    if (!rules) {
      return null;
    }

    return rules.find((rule) => rule.featureKey === featureKey) ?? null;
  }
}
