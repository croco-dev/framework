import type { Money, SubscriptionSnapshot } from "../types";

import type { PlanProvider } from "./interfaces/PlanProvider";
import { MixedCurrencyMRRProblem } from "./problems/MetricsProblems";

/**
 * Calculator for Monthly Recurring Revenue (MRR).
 *
 * MRR measures the predictable monthly revenue generated from subscriptions.
 * Annual plans are normalized to monthly equivalents (amount / 12).
 */
export class MrrCalculator {
  /**
   * Calculate total MRR from active subscriptions.
   *
   * @param subscriptions - Active subscriptions to calculate MRR from
   * @param planRegistry - Registry to look up plan pricing details
   * @returns Total MRR as Money value
   */
  async calculateMRR(
    subscriptions: SubscriptionSnapshot[],
    planProvider: PlanProvider,
  ): Promise<Money> {
    let totalAmount = 0;
    let currency: string | null = null;

    for (const subscription of subscriptions) {
      const plan = await planProvider.getPlan(subscription.planId);
      if (plan === null) {
        continue;
      }

      const normalizedAmount = this.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);

      if (currency !== null && currency !== plan.currency) {
        throw new MixedCurrencyMRRProblem(currency, plan.currency);
      }

      totalAmount += normalizedAmount;
      currency = plan.currency;
    }

    return { amount: totalAmount, currency: currency ?? "USD" };
  }

  /**
   * Normalize plan amount to monthly equivalent.
   *
   * @param amount - Plan amount in minor units
   * @param interval - Plan interval (month or year)
   * @param intervalCount - Number of intervals per billing cycle
   * @returns Normalized monthly MRR amount
   */
  normalizeMRR(amount: number, interval: "month" | "year", intervalCount: number): number {
    if (interval === "year") {
      return amount / intervalCount / 12;
    }

    return amount / intervalCount;
  }

  /**
   * Classify MRR movement type based on event and subscription history.
   *
   * @param event - Order paid event or plan changed event
   * @param hasPreviousSubscription - Whether customer had a subscription before
   * @param wasChurned - Whether previous subscription was churned
   * @param previousAmount - Previous plan amount (if any)
   * @param newAmount - New plan amount
   * @returns MRR movement type
   */
  classifyMRRMovement(
    hasPreviousSubscription: boolean,
    wasChurned: boolean,
    previousAmount: number | null,
    newAmount: number,
  ): "new" | "expansion" | "contraction" | "churned" | "reactivation" | "unchanged" {
    if (!hasPreviousSubscription) {
      return "new";
    }

    if (wasChurned) {
      return "reactivation";
    }

    if (previousAmount === null) {
      return "new";
    }

    if (newAmount > previousAmount) {
      return "expansion";
    }

    if (newAmount < previousAmount) {
      return "contraction";
    }

    return "unchanged";
  }
}
