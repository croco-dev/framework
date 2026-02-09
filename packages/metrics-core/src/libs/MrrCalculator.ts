import type { PlanInterval, PlanRegistry, Subscription } from '@croco/billing-core';
import type { Money } from '../types';

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
  async calculateMRR(subscriptions: Subscription[], planRegistry: PlanRegistry): Promise<Money> {
    let totalAmount = 0;
    let currency = 'USD';

    for (const subscription of subscriptions) {
      const plan = await planRegistry.getPlan(subscription.planId);
      if (plan === null) {
        continue;
      }

      const normalizedAmount = this.normalizeMRR(plan.amount, plan.interval, plan.intervalCount);

      totalAmount += normalizedAmount;
      currency = plan.currency;
    }

    return { amount: totalAmount, currency };
  }

  /**
   * Normalize plan amount to monthly equivalent.
   *
   * @param amount - Plan amount in minor units
   * @param interval - Plan interval (month or year)
   * @param intervalCount - Number of intervals per billing cycle
   * @returns Normalized monthly MRR amount
   */
  normalizeMRR(amount: number, interval: PlanInterval, intervalCount: number): number {
    if (interval === 'year') {
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
    newAmount: number
  ): 'new' | 'expansion' | 'contraction' | 'churned' | 'reactivation' {
    if (!hasPreviousSubscription) {
      return 'new';
    }

    if (wasChurned) {
      return 'reactivation';
    }

    if (previousAmount === null) {
      return 'new';
    }

    if (newAmount > previousAmount) {
      return 'expansion';
    }

    if (newAmount < previousAmount) {
      return 'contraction';
    }

    return 'new';
  }
}
