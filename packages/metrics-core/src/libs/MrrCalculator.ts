import type { Money, SubscriptionSnapshot } from "../types";

import type { PlanProvider } from "./interfaces/PlanProvider";
import { MixedCurrencyMRRProblem } from "./problems/MetricsProblems";

/**
 * Calculator for Monthly Recurring Revenue (MRR).
 *
 * MRR measures the predictable monthly revenue generated from subscriptions.
 * Plan amounts are normalized to monthly equivalents and rounded to whole minor units,
 * with exact halves rounded away from zero. Totals sum the rounded amount per subscription.
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
   * @returns Normalized monthly MRR in whole minor units, rounded half up
   */
  normalizeMRR(amount: number, interval: "month" | "year", intervalCount: number): number {
    const denominator = BigInt(intervalCount) * BigInt(interval === "year" ? 12 : 1);
    const numerator = BigInt(amount);
    const magnitude = numerator < 0 ? -numerator : numerator;
    const roundedMagnitude = (magnitude + denominator / BigInt(2)) / denominator;
    return Number(numerator < 0 ? -roundedMagnitude : roundedMagnitude);
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
