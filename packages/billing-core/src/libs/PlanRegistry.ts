import type { PlanVersionDefinition, PlanVersionRef, ProviderPlanLookup } from "../types";

/**
 * Registry interface for publishing and resolving immutable billing plan versions.
 */
export interface PlanRegistry {
  /**
   * Publish a plan version exactly once. Settle only after all writes have stopped;
   * an ambiguous response must be reconciled before allowing cancellation.
   */
  publishPlanVersion(planVersion: PlanVersionDefinition): Promise<void>;

  /**
   * Get the currently effective version for a plan family.
   */
  getPlan(planId: string): Promise<PlanVersionDefinition | null>;

  /**
   * Get all currently effective plan versions, one per plan family.
   */
  getAllPlans(): Promise<PlanVersionDefinition[]>;

  /**
   * Get an immutable plan version by its pinned reference from authoritative storage.
   * A null result must establish absence after settled publication attempts; a stale
   * replica/cache or an unresolved remote write must not be reported as absence.
   */
  getPlanVersion(ref: PlanVersionRef): Promise<PlanVersionDefinition | null>;

  /**
   * Get every published version, including future-effective versions.
   */
  getAllPlanVersions(planId?: string): Promise<PlanVersionDefinition[]>;

  /**
   * Get the identified plan version effective at a historical instant.
   */
  getPlanAtDate(planId: string, date: Date): Promise<PlanVersionDefinition | null>;

  /**
   * Resolve provider subscription state to exactly one published plan version.
   */
  resolveProviderPlanVersion(lookup: ProviderPlanLookup): Promise<PlanVersionDefinition>;
}
