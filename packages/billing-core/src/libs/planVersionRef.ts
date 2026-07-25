import type { PlanVersionRef } from "../types";
import { InvalidPlanVersionRefProblem } from "./problems/BillingProblems";

export function planVersionRef(value: string): PlanVersionRef {
  if (value.trim().length === 0) {
    throw new InvalidPlanVersionRefProblem();
  }

  return value as PlanVersionRef;
}
