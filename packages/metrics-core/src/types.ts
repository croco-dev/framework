/**

/**
 * Money value with currency.
 */
export type Money = {
  /** Monetary amount in minor units (e.g., cents for USD, won for KRW) */
  amount: number;
  /** ISO 4217 currency code (e.g., 'USD', 'KRW') */
  currency: string;
};

/**
 * Time period for metrics aggregation.
 */
export type Period = {
  /** Period start date (inclusive) */
  from: Date;
  /** Period end date (exclusive) */
  to: Date;
  /** Aggregation granularity */
  granularity: 'day' | 'week' | 'month';
};

/**
 * Percentage value (0-100).
 * Used for churn rates, GRR, NRR, etc.
 */
export type Percentage = number;

/**
 * MRR movement type classification.
 */
export type MRRMovementType = 'new' | 'expansion' | 'contraction' | 'churned' | 'reactivation' | 'unchanged';

/**
 * Monthly Recurring Revenue (MRR) movement breakdown.
 *
 * @formula Net MRR = New + Expansion - Contraction - Churned + Reactivation
 */
export type MRRMovement = {
  /** MRR from new customers */
  new: Money;
  /** MRR from existing customers upgrading/adding seats */
  expansion: Money;
  /** MRR from existing customers downgrading/reducing seats */
  contraction: Money;
  /** MRR from customers who churned */
  churned: Money;
  /** MRR from previously churned customers who returned */
  reactivation: Money;
  /** Net change in MRR (New + Expansion - Contraction - Churned + Reactivation) */
  net: Money;
};

/**
 * Retention metrics measuring customer and revenue retention.
 *
 * @formula Logo Churn Rate = (Churned Customers / Starting Customers) * 100
 * @formula Revenue Churn Rate = (Churned MRR / Starting MRR) * 100
 * @formula GRR = ((Starting MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100
 * @formula NRR = ((Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100
 */
export type RetentionMetrics = {
  /** Customer logo churn rate (0-100) */
  logoChurn: Percentage;
  /** Revenue churn rate (0-100) */
  revenueChurn: Percentage;
  /** Gross Revenue Retention - retention excluding expansion (≤100) */
  grr: Percentage;
  /** Net Revenue Retention - retention including expansion (>100 possible) */
  nrr: Percentage;
};

/**
 * Cohort Capacity result for user and revenue capacity planning.
 *
 * @formula Headroom % = ((Capacity - Current) / Capacity) * 100
 * @formula Daily Churn Rate = 1 - NRR (monthly)
 * @formula Daily Inflow = New MRR per day (for revenue) or New Users per day (for users)
 */
export type CCResult = {
  /** Maximum capacity (users or MRR) */
  capacity: number;
  /** Current count (users or MRR) */
  current: number;
  /** Remaining capacity (capacity - current) */
  headroom: number;
  /** Headroom as percentage of capacity (0-100) */
  headroomPercent: Percentage;
  /** Daily new inflow rate (users/day or MRR/day) */
  dailyInflow: number;
  /** Daily churn rate (0-1, derived from NRR) */
  dailyChurnRate: number;
};

/**
 * Comparison result for carrying capacity simulation (what-if analysis).
 *
 * Compares baseline CC with simulated CC after applying changes
 * (e.g., churn rate reduction, inflow increase).
 */
export type CCComparisonResult = {
  /** Baseline carrying capacity before simulation */
  baseline: CCResult;
  /** Simulated carrying capacity after applying changes */
  simulated: CCResult;
  /** Capacity change (simulated - baseline) */
  capacityDelta: number;
  /** Headroom change (simulated - baseline) */
  headroomDelta: number;
  /** Headroom percent change (simulated - baseline) */
  headroomPercentDelta: Percentage;
};

/**
 * Growth metrics tracking business expansion and sustainability.
 *
 * @formula Quick Ratio = (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)
 */
export type GrowthMetrics = {
  /** New + Expansion / (Churned + Contraction). >1 means growing, <1 means shrinking */
  quickRatio: number;
  /** Optional: User-based cohort capacity analysis */
  userCC?: CCResult;
  /** Optional: Revenue-based cohort capacity analysis */
  revenueCC?: CCResult;
};

/**
 * Customer value metrics.
 *
 * @formula LTV = ARPA / Monthly Churn Rate
 * @formula ARPA = MRR / Active Customer Count
 */
export type CustomerMetrics = {
  /** Lifetime Value - null if churn rate is 0 (infinite LTV) */
  ltv: Money | null;
  /** Average Revenue Per Account */
  arpa: Money;
};

/**
 * Metrics snapshot for a specific date.
 *
 * Represents the aggregated MRR state at a point in time,
 * used for historical analysis and trend calculation.
 */
export type MetricsSnapshot = {
  /** Snapshot date */
  date: Date;
  /** Total Monthly Recurring Revenue */
  totalMRR: Money;
  /** Number of active customers contributing to MRR */
  activeCustomers: number;
  /** Optional: MRR movement breakdown for this period */
  movement?: MRRMovement;
};

export type SubscriptionSnapshot = {
  id: string;
  planId: string;
};

export type PlanSnapshot = {
  id: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
};

export type MultiCurrencyMoney = {
  base: Money;
  converted: Map<string, Money>;
  exchangeRates: Map<string, number>;
  baseCurrency: string;
};

export type CohortData = {
  cohortId: string;
  startDate: Date;
  initialCustomers: number;
  initialMRR: Money;
  periods: CohortPeriodData[];
};

export type CohortPeriodData = {
  periodIndex: number;
  periodStart: Date;
  periodEnd: Date;
  remainingCustomers: number;
  remainingMRR: Money;
  retentionRate: Percentage;
  churnedCustomers: number;
  churnedMRR: Money;
};

export type CohortAnalysisOptions = {
  granularity: 'day' | 'week' | 'month';
  maxPeriods: number;
  startDate?: Date;
  endDate?: Date;
};

export type CohortAnalysisResult = {
  cohorts: CohortData[];
  summary: {
    averageRetentionByPeriod: Map<number, Percentage>;
    weightedAverageRetention: Percentage;
    totalCohorts: number;
  };
};
