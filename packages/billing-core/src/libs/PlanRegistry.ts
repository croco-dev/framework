import { Token } from "@croco/framework-context";
import type { PlanVersionDefinition, PlanVersionRef, ProviderPlanMapping } from "../types";

/**
 * Registry interface for managing billing plans.
 * Implementations: InMemoryPlanRegistry, DrizzlePlanRegistry
 */
export interface PlanRegistry {
  /**
   * Publish a new immutable version. An existing ref can never be overwritten.
   */
  publishPlanVersion(definition: PlanVersionDefinition): Promise<void>;

  /**
   * Resolve an exact version pinned by a subscription.
   */
  getPlanVersion(ref: PlanVersionRef): Promise<PlanVersionDefinition | null>;

  /**
   * Get the latest effective published version of a plan.
   * @param planId - The plan identifier
   * @returns The plan or null if not found
   */
  getPlan(planId: string): Promise<PlanVersionDefinition | null>;

  /**
   * Get all available plans.
   * @returns Array of all plans
   */
  getAllPlans(): Promise<PlanVersionDefinition[]>;

  /**
   * Get a plan as it was configured at a specific point in time.
   * Useful for handling historical pricing (e.g., legacy subscriptions).
   * @param planId - The plan identifier
   * @param date - The date to query historical pricing for
   * @returns The plan at the given date or null if not found
   */
  getPlanAtDate(planId: string, date: Date): Promise<PlanVersionDefinition | null>;

  /**
   * Resolve a provider product/price identity to exactly one published plan version.
   * Implementations throw UnknownPlanVersionMappingProblem for missing or ambiguous mappings.
   */
  resolveProviderPlanVersion(mapping: ProviderPlanMapping): Promise<PlanVersionDefinition>;
}

export const PLAN_REGISTRY_TOKEN = new Token<PlanRegistry>("billing/plan-registry");
