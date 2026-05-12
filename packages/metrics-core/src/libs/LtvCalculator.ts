import type { Money, Period } from "../types";

import { GrossMarginRequiredProblem } from "./problems/MetricsProblems";

export type LtvConfig = {
  arpa: Money;
  monthlyChurnRate: number;
  includeMargin?: boolean;
  grossMargin?: number;
};

/**
 * Calculator for Customer Lifetime Value (LTV) and Average Revenue Per Account (ARPA).
 *
 * LTV measures the total revenue a business can expect from a single customer account.
 * ARPA measures the average revenue generated per account.
 */
export class LtvCalculator {
  /**
   * Calculate Lifetime Value (LTV).
   *
   * Simple LTV formula: ARPA / Monthly Churn Rate
   * With margin formula: (ARPA × Gross Margin%) / Monthly Churn Rate
   *
   * @param config - LTV calculation configuration
   * @returns LTV as Money value, or null if churn rate is 0 (infinite LTV)
   */
  async calculateLTV(config: LtvConfig): Promise<Money | null> {
    const { arpa, monthlyChurnRate, includeMargin, grossMargin } = config;

    if (monthlyChurnRate === 0) {
      return null;
    }

    if (includeMargin && grossMargin === undefined) {
      throw new GrossMarginRequiredProblem();
    }

    const churnRateAsDecimal = monthlyChurnRate / 100;
    let ltvAmount = arpa.amount / churnRateAsDecimal;

    if (includeMargin && grossMargin !== undefined) {
      const marginAsDecimal = grossMargin / 100;
      ltvAmount = (arpa.amount * marginAsDecimal) / churnRateAsDecimal;
    }

    return {
      amount: ltvAmount,
      currency: arpa.currency,
    };
  }

  /**
   * Calculate Average Revenue Per Account (ARPA).
   *
   * ARPA formula: MRR / Active Customer Count
   *
   * @param period - Time period for ARPA calculation
   * @param mrr - Monthly Recurring Revenue
   * @param activeCustomers - Number of active customers
   * @returns ARPA as Money value
   */
  async calculateARPA(_period: Period, mrr: Money, activeCustomers: number): Promise<Money> {
    if (activeCustomers === 0) {
      return {
        amount: 0,
        currency: mrr.currency,
      };
    }

    const arpaAmount = mrr.amount / activeCustomers;

    return {
      amount: arpaAmount,
      currency: mrr.currency,
    };
  }
}
