import type {
  CCComparisonResult,
  CCResult,
  Money,
  MRRMovement,
  MRRMovementType,
  Percentage,
  Period,
  SubscriptionSnapshot,
} from '../types';
import type { CarryingCapacityCalculator, SimulationConfig, UserCCConfig } from './CarryingCapacityCalculator';
import type { GrowthCalculator } from './GrowthCalculator';
import type { PlanProvider } from './interfaces/PlanProvider';
import type { LtvCalculator, LtvConfig } from './LtvCalculator';
import type { MrrCalculator } from './MrrCalculator';
import type { RetentionCalculator } from './RetentionCalculator';
import type { SnapshotInput, SnapshotScheduler } from './SnapshotScheduler';

/**
 * MetricsEngine - Facade service for all metrics calculations.
 *
 * @description
 * Provides a unified interface for calculating SaaS metrics across multiple domains:
 * - MRR (Monthly Recurring Revenue)
 * - Retention (Churn, GRR, NRR)
 * - Growth (Quick Ratio)
 * - Carrying Capacity (User CC, Revenue CC)
 * - Customer Value (LTV, ARPA)
 *
 * All calculations are delegated to specialized Calculator classes.
 * This service is designed for dependency injection via TypeDI Container.
 */
export class MetricsEngine {
  constructor(
    private readonly mrrCalculator: MrrCalculator,
    private readonly retentionCalculator: RetentionCalculator,
    private readonly growthCalculator: GrowthCalculator,
    private readonly ccCalculator: CarryingCapacityCalculator,
    private readonly ltvCalculator: LtvCalculator,
    private readonly snapshotScheduler: SnapshotScheduler
  ) {}

  // ========== MRR Methods ==========

  /**
   * Calculate total Monthly Recurring Revenue from active subscriptions.
   *
   * @param subscriptions - Active subscriptions to calculate MRR from
   * @param planRegistry - Registry to look up plan pricing details
   * @returns Total MRR as Money value
   */
  async calculateMRR(subscriptions: SubscriptionSnapshot[], planProvider: PlanProvider): Promise<Money> {
    return this.mrrCalculator.calculateMRR(subscriptions, planProvider);
  }

  /**
   * Classify MRR movement type based on event and subscription history.
   *
   * @param hasPreviousSubscription - Whether customer had a subscription before
   * @param wasChurned - Whether previous subscription was churned
   * @param previousAmount - Previous plan amount (if any)
   * @param newAmount - New plan amount
   * @returns MRR movement type
   */
  getMRRMovement(
    hasPreviousSubscription: boolean,
    wasChurned: boolean,
    previousAmount: number | null,
    newAmount: number
  ): MRRMovementType {
    return this.mrrCalculator.classifyMRRMovement(hasPreviousSubscription, wasChurned, previousAmount, newAmount);
  }

  // ========== Retention Methods ==========

  /**
   * Calculate churn rate for a period.
   *
   * @param startingMRR - MRR at the start of the period
   * @param movement - MRR movement data for the period
   * @param type - 'logo' for customer churn or 'revenue' for revenue churn
   * @returns Churn rate as percentage (0-100), or null if starting MRR is zero
   */
  async calculateChurn(
    startingMRR: number,
    movement: MRRMovement,
    type: 'logo' | 'revenue'
  ): Promise<Percentage | null> {
    return this.retentionCalculator.calculateChurn(startingMRR, movement, type);
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
    return this.retentionCalculator.calculateGRR(startingMRR, movement);
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
    return this.retentionCalculator.calculateNRR(startingMRR, movement);
  }

  // ========== Growth Methods ==========

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
    return this.growthCalculator.calculateQuickRatio(movement);
  }

  // ========== Carrying Capacity Methods ==========

  /**
   * Get User Carrying Capacity.
   *
   * @param config - Configuration for calculation
   * @returns User CC result, or null if churn rate is 0 (infinite capacity)
   */
  async getCarryingCapacity(config: UserCCConfig): Promise<CCResult | null> {
    return this.ccCalculator.calculateUserCC(config);
  }

  /**
   * Simulate Carrying Capacity with what-if changes.
   *
   * @example
   * // "What if churn decreases by 20%?"
   * const result = await engine.simulateCapacity({ churnChange: -20 });
   *
   * @param changes - Simulation parameters
   * @returns Comparison between baseline and simulated CC
   */
  async simulateCapacity(changes: SimulationConfig): Promise<CCComparisonResult> {
    return this.ccCalculator.simulate(changes);
  }

  // ========== Customer Value Methods ==========

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
    return this.ltvCalculator.calculateLTV(config);
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
  async calculateARPA(period: Period, mrr: Money, activeCustomers: number): Promise<Money> {
    return this.ltvCalculator.calculateARPA(period, mrr, activeCustomers);
  }

  // ========== Snapshot Methods ==========

  /**
   * Capture metrics snapshot for a specific date.
   *
   * @param input - Snapshot input data
   * @param date - Snapshot date (defaults to yesterday)
   * @param tenantId - Optional tenant ID
   */
  async captureSnapshot(input: SnapshotInput, date?: Date, tenantId?: string): Promise<void> {
    const config = tenantId ? { tenantId } : undefined;
    return this.snapshotScheduler.captureSnapshot(input, date, config);
  }
}
