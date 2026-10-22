import type { PlanSnapshot } from "../../types";

export interface PlanProvider {
  /** Resolve an immutable pricing reference, independent of the current time. Return null if unavailable. */
  getPlanVersion(pricingRef: string): Promise<PlanSnapshot | null>;
}
