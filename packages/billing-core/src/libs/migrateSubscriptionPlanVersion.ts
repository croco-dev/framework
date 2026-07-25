import type { LegacySubscription, PlanVersionRef, Subscription } from "../types";
import type { PlanRegistry } from "./PlanRegistry";
import {
  SubscriptionPlanVersionMismatchProblem,
  UnknownPlanVersionProblem,
} from "./problems/BillingProblems";

export async function migrateSubscriptionPlanVersion(
  subscription: LegacySubscription,
  ref: PlanVersionRef,
  registry: PlanRegistry,
): Promise<Subscription> {
  const planVersion = await registry.getPlanVersion(ref);
  if (planVersion === null) {
    throw new UnknownPlanVersionProblem(ref);
  }

  if (planVersion.planId !== subscription.planId) {
    throw new SubscriptionPlanVersionMismatchProblem(
      subscription.id,
      subscription.planId,
      planVersion.planId,
    );
  }

  return {
    ...subscription,
    planVersionRef: planVersion.ref,
  };
}
