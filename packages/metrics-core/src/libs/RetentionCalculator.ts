import type { MRRMovement, Percentage } from "../types";

export type LogoChurnInput = {
  startingCustomers: number;
  endingCustomers: number;
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
   * Formula: (Starting MRR - Churned MRR - Contraction MRR) / Starting MRR
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data for the period
   * @returns GRR as percentage (0-100), or null if starting MRR is zero
   */
  async calculateGRR(startingMRR: number, movement: MRRMovement): Promise<Percentage | null> {
    if (startingMRR === 0) {
      return null;
    }

    const retainedMRR = startingMRR - movement.churned.amount - movement.contraction.amount;
    const grr = (retainedMRR / startingMRR) * 100;

    return Math.min(grr, 100);
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
   * Calculate Logo Churn Rate (customer churn rate based on number of customers).
   *
   * Formula: (Starting Customers - Ending Customers) / Starting Customers * 100
   *
   * @param startingCustomers - Number of customers at start of period
   * @param endingCustomers - Number of customers at end of period
   * @returns Logo Churn as percentage, or null if starting customers is zero
   */
  async calculateLogoChurn(
    startingCustomers: number,
    endingCustomers: number,
  ): Promise<Percentage | null> {
    if (startingCustomers === 0) {
      return null;
    }

    const churnedCustomers = Math.max(startingCustomers - endingCustomers, 0);
    return (churnedCustomers / startingCustomers) * 100;
  }

  /**
   * Calculate all retention metrics at once.
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data for the period
   * @param startingCustomers - Number of customers at start (optional, for logo churn)
   * @param endingCustomers - Number of customers at end (optional, for logo churn)
   * @returns Complete retention metrics
   */
  async calculateRetention(
    startingMRR: number,
    movement: MRRMovement,
    startingCustomers?: number,
    endingCustomers?: number,
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

    let logoChurn: Percentage | null = null;
    if (startingCustomers !== undefined && endingCustomers !== undefined) {
      logoChurn = await this.calculateLogoChurn(startingCustomers, endingCustomers);
    }

    return {
      grr,
      nrr,
      logoChurn,
      revenueChurn,
    };
  }
}
