import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricsRepository } from '../libs/interfaces/MetricsRepository';
import type { PlanProvider } from '../libs/interfaces/PlanProvider';
import type { MrrCalculator } from '../libs/MrrCalculator';
import { SnapshotScheduler, SnapshotTenantRequiredProblem } from '../libs/SnapshotScheduler';
import type { MRRMovement, SubscriptionSnapshot } from '../types';

describe('SnapshotScheduler', () => {
  let scheduler!: SnapshotScheduler;
  let mockRepository!: MetricsRepository;
  let mockPlanProvider!: PlanProvider;
  let mockMrrCalculator!: MrrCalculator;

  const mockSubscriptions: SubscriptionSnapshot[] = [
    {
      id: 'sub_1',
      planId: 'plan_pro',
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

    mockPlanProvider = {
      getPlan: vi.fn().mockResolvedValue({
        id: 'plan_pro',
        amount: 2900,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      }),
    };

    mockMrrCalculator = {
      calculateMRR: vi.fn().mockResolvedValue({ amount: 2900, currency: 'USD' }),
    } as unknown as MrrCalculator;

    scheduler = new SnapshotScheduler(mockRepository, mockMrrCalculator);
  });

  it('should capture snapshot with MRR calculation', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([mockMrrMovement]);

    const input = {
      subscriptions: mockSubscriptions,
      planProvider: mockPlanProvider,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, testDate, { tenantId: 'tenant_123' });

    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    expect(snapshotCall[0]).toBe('tenant_123');
    expect(snapshotCall[1].activeCustomers).toBe(10);
    expect(snapshotCall[1].totalMRR.currency).toBe('USD');
    expect(snapshotCall[1].movement).toEqual(mockMrrMovement);
    expect(mockMrrCalculator.calculateMRR).toHaveBeenCalledWith(mockSubscriptions, mockPlanProvider);
  });

  it('should use yesterday date when not provided', async () => {
    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([]);

    const input = {
      subscriptions: mockSubscriptions,
      planProvider: mockPlanProvider,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, undefined, { tenantId: 'tenant_123' });

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
      planProvider: mockPlanProvider,
      activeCustomers: 5,
    };

    await scheduler.captureSnapshot(input, testDate, { tenantId: 'tenant_123' });

    const snapshotCall = vi.mocked(mockRepository.recordSnapshot).mock.calls[0];
    expect(snapshotCall[1].movement).toBeUndefined();
  });

  it('should use custom tenant ID from config', async () => {
    const testDate = new Date('2025-01-15');
    testDate.setHours(0, 0, 0, 0);

    vi.mocked(mockRepository.getMRRHistory).mockResolvedValue([mockMrrMovement]);

    const input = {
      subscriptions: mockSubscriptions,
      planProvider: mockPlanProvider,
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
      planProvider: mockPlanProvider,
      activeCustomers: 10,
    };

    await scheduler.captureSnapshot(input, testDate, { tenantId: 'tenant_123', retentionLookbackDays: 60 });

    const getMRRHistoryCall = vi.mocked(mockRepository.getMRRHistory).mock.calls[0];
    const periodStart = getMRRHistoryCall[1].from;

    const expectedStart = new Date('2025-01-15');
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 60);

    expect(periodStart.getTime()).toBe(expectedStart.getTime());
  });

  it('should fail fast when tenantId is missing', async () => {
    const input = {
      subscriptions: mockSubscriptions,
      planProvider: mockPlanProvider,
      activeCustomers: 10,
    };

    await expect(scheduler.captureSnapshot(input)).rejects.toBeInstanceOf(SnapshotTenantRequiredProblem);
    expect(mockRepository.recordSnapshot).not.toHaveBeenCalled();
  });
});
