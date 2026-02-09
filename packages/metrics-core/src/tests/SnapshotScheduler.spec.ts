import type { PlanRegistry, Subscription } from '@croco/billing-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricsRepository } from '../libs/interfaces/MetricsRepository';
import { SnapshotScheduler } from '../libs/SnapshotScheduler';
import type { MRRMovement } from '../types';

describe('SnapshotScheduler', () => {
  let scheduler!: SnapshotScheduler;
  let mockRepository!: MetricsRepository;
  let mockPlanRegistry!: PlanRegistry;

  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub_1',
      billingAccountId: 'ba_1',
      externalSubscriptionId: 'ext_1',
      planId: 'plan_pro',
      status: 'active',
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      lastSyncedAt: new Date('2025-01-01'),
    },
  ];

  const mockMrrMovement: MRRMovement = {
    new: { amount: 1000, currency: 'USD' },
    expansion: { amount: 500, currency: 'USD' },
    contraction: { amount: 100, currency: 'USD' },
    churned: { amount: 200, currency: 'USD' },
    reactivation: { amount: 50, currency: 'USD' },
    net: { amount: 1250, currency: 'USD' },
  };

  beforeEach(() => {
    mockRepository = {
      recordMRRMovement: vi.fn(),
      recordSnapshot: vi.fn(),
      getSnapshot: vi.fn(),
      getMRRHistory: vi.fn(),
      getRetentionMetrics: vi.fn(),
    };

    mockPlanRegistry = {
      getPlan: vi.fn().mockResolvedValue({
        id: 'plan_pro',
        name: 'Pro Plan',
        amount: 2900,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      }),
      getAllPlans: vi.fn(),
      getPlanAtDate: vi.fn(),
    };

    scheduler = new SnapshotScheduler(mockRepository);
  });

  it('should capture snapshot with MRR calculation', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([mockMrrMovement]);

    const input = {
      subscriptions: mockSubscriptions,
      planRegistry: mockPlanRegistry,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, testDate);

    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    expect(snapshotCall[0]).toBe('default');
    expect(snapshotCall[1].activeCustomers).toBe(10);
    expect(snapshotCall[1].totalMRR.currency).toBe('USD');
    expect(snapshotCall[1].movement).toEqual(mockMrrMovement);
  });

  it('should use yesterday date when not provided', async () => {
    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([]);

    const input = {
      subscriptions: mockSubscriptions,
      planRegistry: mockPlanRegistry,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input);

    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    const snapshotDate = snapshotCall[1].date;
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - 1);
    expectedDate.setHours(0, 0, 0, 0);

    expect(snapshotDate.getTime()).toBe(expectedDate.getTime());
  });

  it('should handle empty MRR history', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([]);

    const input = {
      subscriptions: mockSubscriptions,
      planRegistry: mockPlanRegistry,
      activeCustomers: 5,
    };

    await scheduler.captureSnapshot(input, testDate);

    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    expect(snapshotCall[1].movement).toBeUndefined();
  });

  it('should use custom tenant ID from config', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([mockMrrMovement]);

    const input = {
      subscriptions: mockSubscriptions,
      planRegistry: mockPlanRegistry,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, testDate, { tenantId: 'tenant_123' });

    expect(mockRepository.getMRRHistory).toHaveBeenCalledWith('tenant_123', expect.any(Object));
    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    expect(snapshotCall[0]).toBe('tenant_123');
  });

  it('should calculate lookback period correctly', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([]);

    const input = {
      subscriptions: mockSubscriptions,
      planRegistry: mockPlanRegistry,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, testDate, { retentionLookbackDays: 60 });

    const getMRRHistoryCall = vi.mocked(mockRepository.getMRRHistory).mock.calls[0];
    const periodStart = getMRRHistoryCall[1].from;

    const expectedStart = new Date('2025-01-15');
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 60);

    expect(periodStart.getTime()).toBe(expectedStart.getTime());
  });
});
