import type { MRRMovement, Percentage } from "../types";
import { InvalidRetentionMovementProblem } from "./problems/MetricsProblems";

export type LogoChurnInput = {
  /** Distinct customers active at the start of the period. */
  startingCustomers: number;
  /** Distinct starting customers who churned in the period and are inactive at its end. */
  churnedStartingCustomers: number;
};

export class RetentionCalculator {
  async calculateChurn(
    startingMRR: number,
    movement: MRRMovement,
    _type: "revenue",
  ): Promise<Percentage | null> {
    if (startingMRR === 0) {
      return null;
    }

    return (movement.churned.amount / startingMRR) * 100;
  }

  /**
   * Calculate Gross Revenue Retention (GRR) for a period.
   *
   * Formula: max(0, min(100, ((Starting MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100))
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data with finite, non-negative churn and contraction amounts
   * @returns GRR as percentage (0-100), or null if starting MRR is zero
   * @throws InvalidRetentionMovementProblem when churn or contraction is negative or non-finite
   */
  async calculateGRR(startingMRR: number, movement: MRRMovement): Promise<Percentage | null> {
    this.validateGRRLoss("churned", movement.churned.amount);
    this.validateGRRLoss("contraction", movement.contraction.amount);

    if (startingMRR === 0) {
      return null;
    }

    const retainedMRR = startingMRR - movement.churned.amount - movement.contraction.amount;
    const grr = (retainedMRR / startingMRR) * 100;

    return Math.max(0, Math.min(grr, 100));
  }

  /**
   * Calculate Net Revenue Retention (NRR) for a period.
   *
   * Formula: (Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data for the period
   * @returns NRR as percentage (can be >100%), or null if starting MRR is zero
   */
  async calculateNRR(startingMRR: number, movement: MRRMovement): Promise<Percentage | null> {
    if (startingMRR === 0) {
      return null;
    }

    const endingMRR =
      startingMRR +
      movement.expansion.amount -
      movement.churned.amount -
      movement.contraction.amount;
    const nrr = (endingMRR / startingMRR) * 100;

    return nrr;
  }

  /**
   * Calculate logo churn for the starting customer cohort.
   *
   * Count each lost starting customer once. Customers who reactivate and are active at
   * the period end stay in the cohort. Customers acquired during the period do not enter it.
   *
   * @param input - Cohort counts as non-negative safe integers
   * @returns Logo churn as a percentage, or null for empty or unusable cohort counts
   */
  async calculateLogoChurn(input: LogoChurnInput): Promise<Percentage | null> {
    if (!input || typeof input !== "object") {
      return null;
    }

    const { startingCustomers, churnedStartingCustomers } = input;
    if (
      !Number.isSafeInteger(startingCustomers) ||
      startingCustomers <= 0 ||
      !Number.isSafeInteger(churnedStartingCustomers) ||
      churnedStartingCustomers < 0 ||
      churnedStartingCustomers > startingCustomers
    ) {
      return null;
    }

    return (churnedStartingCustomers / startingCustomers) * 100;
  }

  /**
   * Calculate all retention metrics at once.
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data with finite, non-negative churn and contraction amounts
   * @param logoChurnInput - Optional evidence for logo churn from the starting cohort
   * @returns Retention metrics with null logo churn when cohort evidence is unavailable
   * @throws InvalidRetentionMovementProblem when churn or contraction is negative or non-finite
   */
  async calculateRetention(
    startingMRR: number,
    movement: MRRMovement,
    logoChurnInput?: LogoChurnInput,
  ): Promise<{
    grr: Percentage | null;
    nrr: Percentage | null;
    logoChurn: Percentage | null;
    revenueChurn: Percentage | null;
  }> {
    const [grr, nrr, revenueChurn] = await Promise.all([
      this.calculateGRR(startingMRR, movement),
      this.calculateNRR(startingMRR, movement),
      this.calculateChurn(startingMRR, movement, "revenue"),
    ]);

    const logoChurn =
      logoChurnInput === undefined ? null : await this.calculateLogoChurn(logoChurnInput);

    return {
      grr,
      nrr,
      logoChurn,
      revenueChurn,
    };
  }

  private validateGRRLoss(field: "churned" | "contraction", amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvalidRetentionMovementProblem(field, amount);
    }
  }
}
