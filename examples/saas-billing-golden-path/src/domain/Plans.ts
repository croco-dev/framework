import { CheckoutValidationProblem } from "./Problems";
import type { PlanId } from "./types";

type Plan = {
  readonly id: PlanId;
  readonly monthlySeatPriceCents: number;
};

const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    monthlySeatPriceCents: 2900,
  },
  growth: {
    id: "growth",
    monthlySeatPriceCents: 7900,
  },
};

export function calculateAmountCents(planId: PlanId, seats: number): number {
  return getPlan(planId).monthlySeatPriceCents * seats;
}

export function getPlan(planId: PlanId): Plan {
  const plan = PLANS[planId];
  if (!plan) {
    throw new CheckoutValidationProblem(`Unsupported plan '${planId}'.`);
  }

  return plan;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "growth";
}
