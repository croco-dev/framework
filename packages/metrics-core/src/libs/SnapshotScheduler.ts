import { Problem, ProblemCategory } from '@croco/problems-core';
import type { MetricsSnapshot, MRRMovement, SubscriptionSnapshot } from '../types';
import type { MetricsRepository } from './interfaces/MetricsRepository';
import type { PlanProvider } from './interfaces/PlanProvider';
import { MrrCalculator } from './MrrCalculator';

export type SnapshotSchedulerConfig = {
  tenantId: string;
  retentionLookbackDays?: number;
};

export type SnapshotInput = {
  subscriptions: SubscriptionSnapshot[];
  planProvider: PlanProvider;
  activeCustomers: number;
};

export class SnapshotTenantRequiredProblem extends Problem {
  readonly code = 'metrics-core/snapshot-tenant-required';
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super('tenantId is required for snapshot capture');
  }
}

export class SnapshotScheduler {
  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly mrrCalculator: MrrCalculator = new MrrCalculator()
  ) {}

  async captureSnapshot(
    input: SnapshotInput,
    date: Date = this.getYesterday(),
    config?: SnapshotSchedulerConfig
  ): Promise<void> {
    if (!config?.tenantId) {
      throw new SnapshotTenantRequiredProblem();
    }

    const { tenantId, retentionLookbackDays = 30 } = config;
    const { subscriptions, planProvider, activeCustomers } = input;

    const totalMRR = await this.mrrCalculator.calculateMRR(subscriptions, planProvider);

    const snapshotDate = new Date(date);
    snapshotDate.setHours(0, 0, 0, 0);

    const periodStart = new Date(snapshotDate);
    periodStart.setDate(periodStart.getDate() - retentionLookbackDays);

    const mrrHistory = await this.metricsRepository.getMRRHistory(tenantId, {
      from: periodStart,
      to: snapshotDate,
      granularity: 'day',
    });

    let movement: MRRMovement | undefined;

    if (mrrHistory.length > 0) {
      movement = mrrHistory[mrrHistory.length - 1];
    }

    const snapshot: MetricsSnapshot = {
      date: snapshotDate,
      totalMRR,
      activeCustomers,
      movement,
    };

    await this.metricsRepository.recordSnapshot(tenantId, snapshot, snapshotDate);
  }

  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }
}
