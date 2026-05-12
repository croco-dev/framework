import type { Plan } from "../types";

/**
 * Registry interface for managing billing plans.
 * Implementations: InMemoryPlanRegistry, DrizzlePlanRegistry
 */
export interface PlanRegistry {
  /**
   * Get a plan by ID.
   * @param planId - The plan identifier
   * @returns The plan or null if not found
   */
  getPlan(planId: string): Promise<Plan | null>;

  /**
   * Get all available plans.
   * @returns Array of all plans
   */
  getAllPlans(): Promise<Plan[]>;

  /**
   * Get a plan as it was configured at a specific point in time.
   * Useful for handling historical pricing (e.g., legacy subscriptions).
   * @param planId - The plan identifier
   * @param date - The date to query historical pricing for
   * @returns The plan at the given date or null if not found
   */
  getPlanAtDate(planId: string, date: Date): Promise<Plan | null>;
}
