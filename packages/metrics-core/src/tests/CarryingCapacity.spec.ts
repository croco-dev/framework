import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveUserProvider, MetricsRepository, MRRMovement } from '..';
import { CarryingCapacityCalculator } from '../libs/CarryingCapacityCalculator';

describe('CarryingCapacityCalculator', () => {
  let calculator!: CarryingCapacityCalculator;
  let mockUserProvider: ActiveUserProvider;
  let mockMetricsRepository: MetricsRepository;

  beforeEach(() => {
    mockUserProvider = {
      getDailyActiveUsers: vi.fn(),
      getNewUsersCount: vi.fn(),
      getChurnedUsersCount: vi.fn(),
    };

    mockMetricsRepository = {
      recordMRRMovement: vi.fn(),
      recordSnapshot: vi.fn(),
      getSnapshot: vi.fn(),
      getMRRHistory: vi.fn(),
      getRetentionMetrics: vi.fn(),
    };

    calculator = new CarryingCapacityCalculator(mockUserProvider, mockMetricsRepository);
  });

  describe('calculateUserCC', () => {
    it('should calculate User CC correctly with daily inflow=1000, NRR=98%', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(1000);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(10000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30 });

      expect(result).not.toBeNull();
      if (!result) return;

      const expectedCapacity = 1000 / (-Math.log(0.98) / 30);
      expect(result.capacity).toBeCloseTo(expectedCapacity, 0);
      expect(result.current).toBe(10000);
      expect(result.dailyInflow).toBe(1000);
      expect(result.dailyChurnRate).toBeCloseTo(-Math.log(0.98) / 30, 6);
    });

    it('should return null when churn rate is 0 (infinite capacity)', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(1000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 0,
        revenueChurn: 0,
        grr: 100,
        nrr: 100,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30 });

      expect(result).toBeNull();
    });

    it('should aggregate new users over lookback period', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(500);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(5000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30 });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.dailyInflow).toBe(500);
    });

    it('should support tenant-specific calculation', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(100);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(1000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30, tenantId: 'tenant-123' });

      expect(mockUserProvider.getNewUsersCount).toHaveBeenCalledWith(expect.any(Date), 'tenant-123');
      expect(result).not.toBeNull();
    });
  });

  describe('calculateRevenueCC', () => {
    const mockMovements: MRRMovement[] = [
      {
        new: { amount: 30000, currency: 'USD' },
        expansion: { amount: 10000, currency: 'USD' },
        contraction: { amount: 5000, currency: 'USD' },
        churned: { amount: 8000, currency: 'USD' },
        reactivation: { amount: 2000, currency: 'USD' },
        net: { amount: 29000, currency: 'USD' },
      },
      {
        new: { amount: 35000, currency: 'USD' },
        expansion: { amount: 12000, currency: 'USD' },
        contraction: { amount: 6000, currency: 'USD' },
        churned: { amount: 9000, currency: 'USD' },
        reactivation: { amount: 3000, currency: 'USD' },
        net: { amount: 35000, currency: 'USD' },
      },
    ];

    it('should calculate Revenue CC correctly with monthly new MRR=30000, NRR=98%', async () => {
      vi.spyOn(mockMetricsRepository, 'getMRRHistory').mockResolvedValue(mockMovements);
      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });
      vi.spyOn(mockMetricsRepository, 'getSnapshot').mockResolvedValue({
        date: new Date('2026-02-10'),
        totalMRR: { amount: 500000, currency: 'USD' },
        activeCustomers: 5000,
      });

      const result = await calculator.calculateRevenueCC({ lookbackMonths: 2 });

      expect(result).not.toBeNull();
      if (!result) return;

      const monthlyNewMRR = (30000 + 35000) / 2;
      const expectedCapacity = monthlyNewMRR / 0.02;
      expect(result.capacity).toBeCloseTo(expectedCapacity, 0);
      expect(result.current).toBe(500000);
      expect(result.headroom).toBeCloseTo(expectedCapacity - 500000, 0);
      expect(result.headroomPercent).toBeCloseTo(((expectedCapacity - 500000) / expectedCapacity) * 100, 1);
    });

    it('should return null when NRR is 100% (infinite capacity)', async () => {
      vi.spyOn(mockMetricsRepository, 'getMRRHistory').mockResolvedValue(mockMovements);
      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 0,
        revenueChurn: 0,
        grr: 100,
        nrr: 100,
      });

      const result = await calculator.calculateRevenueCC({ lookbackMonths: 2 });

      expect(result).toBeNull();
    });

    it('should handle missing snapshot (current = 0)', async () => {
      vi.spyOn(mockMetricsRepository, 'getMRRHistory').mockResolvedValue(mockMovements);
      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });
      vi.spyOn(mockMetricsRepository, 'getSnapshot').mockResolvedValue(null);

      const result = await calculator.calculateRevenueCC({ lookbackMonths: 2 });

      expect(result).not.toBeNull();
      if (!result) return;

      const monthlyNewMRR = (30000 + 35000) / 2;
      const expectedCapacity = monthlyNewMRR / 0.02;

      expect(result.current).toBe(0);
      expect(result.headroom).toBeCloseTo(expectedCapacity, 0);
    });
  });

  describe('simulate', () => {
    beforeEach(() => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(1000);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(10000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });
    });

    it('should simulate churn reduction by 20%', async () => {
      const result = await calculator.simulate({ churnChange: -20 });

      const expectedBaseline = 1000 / (-Math.log(0.98) / 30);

      expect(result.baseline.capacity).toBeCloseTo(expectedBaseline, 0);
      expect(result.simulated.capacity).toBeGreaterThan(result.baseline.capacity);
      expect(result.capacityDelta).toBeGreaterThan(0);
      expect(result.simulated.dailyChurnRate).toBeCloseTo((-Math.log(0.98) / 30) * 0.8, 3);
    });

    it('should simulate inflow increase by 50%', async () => {
      const result = await calculator.simulate({ inflowChange: 50 });

      const expectedBaseline = 1000 / (-Math.log(0.98) / 30);
      const expectedSimulated = 1500 / (-Math.log(0.98) / 30);

      expect(result.baseline.capacity).toBeCloseTo(expectedBaseline, 0);
      expect(result.simulated.capacity).toBeCloseTo(expectedSimulated, 0);
      expect(result.capacityDelta).toBeCloseTo(expectedSimulated - expectedBaseline, 0);
      expect(result.simulated.dailyInflow).toBe(1500);
    });

    it('should simulate both churn and inflow changes', async () => {
      const result = await calculator.simulate({ inflowChange: 20, churnChange: -20 });

      expect(result.simulated.capacity).toBeGreaterThan(result.baseline.capacity);
      expect(result.headroomDelta).toBeGreaterThan(0);
      expect(result.headroomPercentDelta).toBeGreaterThan(0);
    });

    it('should throw error when baseline is null', async () => {
      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 0,
        revenueChurn: 0,
        grr: 100,
        nrr: 100,
      });

      await expect(calculator.simulate({ churnChange: -20 })).rejects.toThrow('Cannot simulate: baseline CC is null');
    });

    it('should throw error when simulated churn rate is zero', async () => {
      await expect(calculator.simulate({ churnChange: -100 })).rejects.toThrow('Simulated churn rate is zero');
    });

    it('should calculate correct headroom percent delta', async () => {
      const result = await calculator.simulate({ churnChange: -20 });

      const expectedBaseline = 1000 / (-Math.log(0.98) / 30);
      const baselineHeadroomPercent = ((expectedBaseline - 10000) / expectedBaseline) * 100;

      const simulatedChurnRate = (-Math.log(0.98) / 30) * 0.8;
      const expectedSimulated = 1000 / simulatedChurnRate;
      const simulatedHeadroomPercent = ((expectedSimulated - 10000) / expectedSimulated) * 100;

      expect(result.headroomPercentDelta).toBeCloseTo(simulatedHeadroomPercent - baselineHeadroomPercent, 1);
    });
  });

  describe('buildCCResult', () => {
    it('should calculate headroom and headroom percent correctly', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(1000);

      const expectedCapacity = 1000 / (-Math.log(0.98) / 30);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(Math.floor(expectedCapacity));

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30 });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.headroom).toBeCloseTo(0, 0);
      expect(result.headroomPercent).toBeCloseTo(0, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero new users', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(0);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(1000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateUserCC({ lookbackDays: 30 });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.capacity).toBe(0);
      expect(result.headroom).toBe(0);
    });

    it('should handle empty movements array for Revenue CC', async () => {
      vi.spyOn(mockMetricsRepository, 'getMRRHistory').mockResolvedValue([]);
      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      const result = await calculator.calculateRevenueCC({ lookbackMonths: 2 });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.capacity).toBe(0);
    });

    it('should handle negative churn change that would result in negative churn', async () => {
      vi.spyOn(mockUserProvider, 'getNewUsersCount').mockResolvedValue(1000);
      vi.spyOn(mockUserProvider, 'getDailyActiveUsers').mockResolvedValue(10000);

      vi.spyOn(mockMetricsRepository, 'getRetentionMetrics').mockResolvedValue({
        logoChurn: 2,
        revenueChurn: 2,
        grr: 98,
        nrr: 98,
      });

      await expect(calculator.simulate({ churnChange: -100 })).rejects.toThrow('Simulated churn rate is zero');
    });
  });
});
