import type { MRRMovement } from "../types";

/**
 * Calculator for business growth metrics.
 *
 * Measures how fast a business is growing and its sustainability:
 * - Quick Ratio: (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)
 */
export class GrowthCalculator {
  /**
   * Calculate Quick Ratio for a period.
   *
   * Quick Ratio measures how much new revenue is coming in compared to revenue leaving.
   * - >4: Excellent growth
   * - 2-4: Healthy growth
   * - 1-2: Moderate growth
   * - <1: Declining (at risk)
   *
   * @param movement - MRR movement data for the period
   * @returns Quick Ratio, or null if denominator is zero
   */
  async calculateQuickRatio(movement: MRRMovement): Promise<number | null> {
    const newMRR = movement.new.amount + movement.expansion.amount;
    const lostMRR = movement.churned.amount + movement.contraction.amount;

    if (lostMRR === 0) {
      return null;
    }

    return newMRR / lostMRR;
  }
}
