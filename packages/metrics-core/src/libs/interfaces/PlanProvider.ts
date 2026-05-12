import type { PlanSnapshot } from "../../types";

export interface PlanProvider {
  getPlan(planId: string): Promise<PlanSnapshot | null>;
}
