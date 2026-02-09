import type { PlanRegistry, Subscription } from '@croco/billing-core';
import type { MetricsSnapshot, MRRMovement } from '../types';
import type { MetricsRepository } from './interfaces/MetricsRepository';
import { MrrCalculator } from './MrrCalculator';

export type SnapshotSchedulerConfig = {
  tenantId?: string;
  retentionLookbackDays?: number;
};

export type SnapshotInput = {
  subscriptions: Subscription[];
  planRegistry: PlanRegistry;
  activeCustomers: number;
};

export class SnapshotScheduler {
  constructor(private readonly metricsRepository: MetricsRepository) {}

  async captureSnapshot(
    input: SnapshotInput,
    date: Date = this.getYesterday(),
    config?: SnapshotSchedulerConfig
  ): Promise<void> {
    const { tenantId, retentionLookbackDays = 30 } = config ?? {};
    const { subscriptions, planRegistry, activeCustomers } = input;

    const mrrCalculator = new MrrCalculator();
    const totalMRR = await mrrCalculator.calculateMRR(subscriptions, planRegistry);

    const snapshotDate = new Date(date);
    snapshotDate.setHours(0, 0, 0, 0);

    const periodStart = new Date(snapshotDate);
    periodStart.setDate(periodStart.getDate() - retentionLookbackDays);

    const mrrHistory = await this.metricsRepository.getMRRHistory(tenantId ?? 'default', {
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

    await this.metricsRepository.recordSnapshot(tenantId ?? 'default', snapshot, snapshotDate);
  }

  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }
}
