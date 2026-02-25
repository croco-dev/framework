import type { CCComparisonResult, CCResult } from '../types';
import type { ActiveUserProvider } from './interfaces/ActiveUserProvider';
import type { MetricsRepository } from './interfaces/MetricsRepository';
import { CarryingCapacitySimulationProblem } from './problems/MetricsProblems';

/**
 * Configuration for User Carrying Capacity calculation.
 */
export type UserCCConfig = {
  /** Number of days to look back for calculating average daily inflow/churn */
  lookbackDays: number;
  /** Optional tenant ID for tenant-specific calculation */
  tenantId?: string;
};

/**
 * Configuration for Revenue Carrying Capacity calculation.
 */
export type RevenueCCConfig = {
  /** Number of months to look back for calculating monthly averages */
  lookbackMonths: number;
  /** Optional tenant ID for tenant-specific calculation */
  tenantId?: string;
};

/**
 * Configuration for Carrying Capacity simulation.
 */
export type SimulationConfig = {
  /** Percentage change in daily inflow (-100 to +∞, e.g., 20 = +20%) */
  inflowChange?: number;
  /** Percentage change in churn rate (-100 to +100, e.g., -20 = -20% churn) */
  churnChange?: number;
};

/**
 * Calculator for Carrying Capacity (User CC & Revenue CC).
 *
 * @description
 * Carrying Capacity measures the maximum sustainable scale given current inflow and churn rates.
 *
 * User CC: Maximum users sustainable = Daily New Users / Daily Churn Rate
 * Revenue CC: Maximum MRR sustainable = Monthly New MRR / (1 - NRR)
 *
 * @example
 * ```typescript
 * const calculator = new CarryingCapacityCalculator(userProvider, metricsRepo);
 *
 * // Calculate User CC (e.g., 1000 daily new users, 2% daily churn → 50,000 capacity)
 * const userCC = await calculator.calculateUserCC({ lookbackDays: 30 });
 *
 * // Simulate: "What if we reduce churn by 20%?"
 * const simulation = await calculator.simulate({ churnChange: -20 });
 * console.log(`Capacity increases from ${userCC.capacity} to ${simulation.simulated.capacity}`);
 * ```
 */
export class CarryingCapacityCalculator {
  constructor(
    private readonly userProvider: ActiveUserProvider,
    private readonly metricsRepository: MetricsRepository
  ) {}

  /**
   * Calculate User Carrying Capacity.
   *
   * @formula Capacity = Daily New Users / Daily Churn Rate
   * @formula Daily Churn Rate = (1 - (NRR / 100)) ^ (1/30) (derived from monthly NRR)
   *
   * @param config - Configuration for calculation
   * @returns User CC result, or null if churn rate is 0 (infinite capacity)
   */
  async calculateUserCC(config: UserCCConfig): Promise<CCResult | null> {
    const { lookbackDays, tenantId } = config;
    const now = new Date();

    let totalNewUsers = 0;
    for (let i = 0; i < lookbackDays; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      totalNewUsers += await this.userProvider.getNewUsersCount(date, tenantId);
    }
    const dailyInflow = totalNewUsers / lookbackDays;

    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - lookbackDays);
    const retention = await this.metricsRepository.getRetentionMetrics(tenantId ?? 'default', {
      from: periodStart,
      to: now,
      granularity: 'day',
    });

    const dailyChurnRate = -Math.log(retention.nrr / 100) / 30;

    if (dailyChurnRate <= 0) {
      return null;
    }

    const capacity = dailyInflow / dailyChurnRate;
    const current = await this.userProvider.getDailyActiveUsers(now, tenantId);

    return this.buildCCResult(capacity, current, dailyInflow, dailyChurnRate);
  }

  /**
   * Calculate Revenue Carrying Capacity.
   *
   * @formula Capacity = Monthly New MRR / (1 - NRR)
   * @returns Revenue CC result, or null if NRR = 100% (infinite capacity)
   */
  async calculateRevenueCC(config: RevenueCCConfig): Promise<CCResult | null> {
    const { lookbackMonths, tenantId } = config;
    const now = new Date();

    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - lookbackMonths);

    const movements = await this.metricsRepository.getMRRHistory(tenantId ?? 'default', {
      from: periodStart,
      to: now,
      granularity: 'month',
    });

    const totalNewMRR = movements.reduce((sum, m) => sum + m.new.amount, 0);
    const monthlyNewMRR = totalNewMRR / lookbackMonths;

    const retention = await this.metricsRepository.getRetentionMetrics(tenantId ?? 'default', {
      from: periodStart,
      to: now,
      granularity: 'month',
    });

    const churnFactor = 1 - retention.nrr / 100;
    if (churnFactor <= 0) {
      return null;
    }

    const capacity = monthlyNewMRR / churnFactor;
    const snapshot = await this.metricsRepository.getSnapshot(tenantId ?? 'default', now);
    const current = snapshot?.totalMRR.amount ?? 0;

    const dailyInflow = monthlyNewMRR / 30;
    const dailyChurnRate = churnFactor / 30;

    return this.buildCCResult(capacity, current, dailyInflow, dailyChurnRate);
  }

  /**
   * Simulate Carrying Capacity with what-if changes.
   *
   * @example
   * // "What if churn decreases by 20%?"
   * const result = await calculator.simulate({ churnChange: -20 });
   *
   * @param changes - Simulation parameters
   * @returns Comparison between baseline and simulated CC
   */
  async simulate(changes: SimulationConfig): Promise<CCComparisonResult> {
    const baseline = await this.calculateUserCC({ lookbackDays: 30 });

    if (!baseline) {
      throw new CarryingCapacitySimulationProblem('Cannot simulate: baseline CC is null (infinite capacity)');
    }

    const inflowMultiplier = changes.inflowChange ? 1 + changes.inflowChange / 100 : 1;
    const churnMultiplier = changes.churnChange ? 1 + changes.churnChange / 100 : 1;

    const simulatedDailyInflow = baseline.dailyInflow * inflowMultiplier;
    const simulatedDailyChurnRate = Math.max(0, baseline.dailyChurnRate * churnMultiplier);

    if (simulatedDailyChurnRate <= 0) {
      throw new CarryingCapacitySimulationProblem('Simulated churn rate is zero → infinite capacity');
    }

    const simulatedCapacity = simulatedDailyInflow / simulatedDailyChurnRate;
    const simulatedHeadroom = Math.max(0, simulatedCapacity - baseline.current);
    const simulatedHeadroomPercent = (simulatedHeadroom / simulatedCapacity) * 100;

    const simulated: CCResult = {
      capacity: simulatedCapacity,
      current: baseline.current,
      headroom: simulatedHeadroom,
      headroomPercent: simulatedHeadroomPercent,
      dailyInflow: simulatedDailyInflow,
      dailyChurnRate: simulatedDailyChurnRate,
    };

    return {
      baseline,
      simulated,
      capacityDelta: simulatedCapacity - baseline.capacity,
      headroomDelta: simulatedHeadroom - baseline.headroom,
      headroomPercentDelta: simulatedHeadroomPercent - baseline.headroomPercent,
    };
  }

  /**
   * Build CCResult from calculated values.
   */
  private buildCCResult(capacity: number, current: number, dailyInflow: number, dailyChurnRate: number): CCResult {
    const headroom = Math.max(0, capacity - current);
    const headroomPercent = (headroom / capacity) * 100;

    return {
      capacity,
      current,
      headroom,
      headroomPercent,
      dailyInflow,
      dailyChurnRate,
    };
  }
}
