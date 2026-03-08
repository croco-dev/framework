import { beforeEach, describe, expect, it } from 'vitest';
import { LtvCalculator } from '../libs/LtvCalculator';
import { GrossMarginRequiredProblem } from '../libs/problems/MetricsProblems';
import type { Money, Period } from '../types';

describe('LtvCalculator', () => {
  let calculator!: LtvCalculator;

  beforeEach(() => {
    calculator = new LtvCalculator();
  });

  describe('Fixture: ARPA $100, Churn 2%, Margin 80% → LTV $4,000', () => {
    it('should calculate simple LTV without margin', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' }, // $100
        monthlyChurnRate: 2, // 2%
        includeMargin: false,
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toEqual({
        amount: 500000, // $100 / 0.02 = $5,000
        currency: 'USD',
      });
    });

    it('should calculate LTV with gross margin', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' }, // $100
        monthlyChurnRate: 2, // 2%
        includeMargin: true,
        grossMargin: 80, // 80%
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toEqual({
        amount: 400000, // ($100 × 0.8) / 0.02 = $4,000
        currency: 'USD',
      });
    });
  });

  describe('calculateARPA', () => {
    it('should calculate ARPA from MRR and active customers', async () => {
      const period: Period = {
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
        granularity: 'month',
      };

      const mrr: Money = { amount: 1000000, currency: 'USD' }; // $10,000
      const activeCustomers = 100;

      const result = await calculator.calculateARPA(period, mrr, activeCustomers);

      expect(result).toEqual({
        amount: 10000, // $10,000 / 100 = $100
        currency: 'USD',
      });
    });

    it('should handle different currencies', async () => {
      const period: Period = {
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
        granularity: 'month',
      };

      const mrr: Money = { amount: 5000000, currency: 'KRW' }; // 50,000 KRW
      const activeCustomers = 100;

      const result = await calculator.calculateARPA(period, mrr, activeCustomers);

      expect(result).toEqual({
        amount: 50000, // 50,000 / 100 = 500 KRW
        currency: 'KRW',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return null when churn rate is 0 (infinite LTV)', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' },
        monthlyChurnRate: 0,
        includeMargin: false,
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toBeNull();
    });

    it('should return null when churn rate is 0 with margin', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' },
        monthlyChurnRate: 0,
        includeMargin: true,
        grossMargin: 80,
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toBeNull();
    });

    it('should return 0 ARPA when no active customers', async () => {
      const period: Period = {
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
        granularity: 'month',
      };

      const mrr: Money = { amount: 1000000, currency: 'USD' };
      const activeCustomers = 0;

      const result = await calculator.calculateARPA(period, mrr, activeCustomers);

      expect(result).toEqual({
        amount: 0,
        currency: 'USD',
      });
    });

    it('should handle 100% churn rate (LTV = ARPA)', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' },
        monthlyChurnRate: 100, // 100%
        includeMargin: false,
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toEqual({
        amount: 10000, // $100 / 1.0 = $100
        currency: 'USD',
      });
    });

    it('should handle 0% gross margin', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' },
        monthlyChurnRate: 2,
        includeMargin: true,
        grossMargin: 0, // 0%
      };

      const result = await calculator.calculateLTV(config);

      expect(result).toEqual({
        amount: 0, // ($100 × 0) / 0.02 = $0
        currency: 'USD',
      });
    });

    it('should fail fast when includeMargin is true but grossMargin is missing', async () => {
      const config = {
        arpa: { amount: 10000, currency: 'USD' },
        monthlyChurnRate: 2,
        includeMargin: true,
      };

      await expect(calculator.calculateLTV(config)).rejects.toBeInstanceOf(GrossMarginRequiredProblem);
    });
  });

  describe('Golden Fixture: 종합 LTV 계산 시나리오', () => {
    it('should calculate complete customer metrics with margin', async () => {
      const period: Period = {
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
        granularity: 'month',
      };

      const mrr: Money = { amount: 5000000, currency: 'USD' }; // $50,000 MRR
      const activeCustomers = 500; // 500 customers
      const monthlyChurnRate = 2.5; // 2.5% churn
      const grossMargin = 75; // 75% margin

      // ARPA = $50,000 / 500 = $100
      const arpaResult = await calculator.calculateARPA(period, mrr, activeCustomers);

      expect(arpaResult).toEqual({
        amount: 10000, // $100
        currency: 'USD',
      });

      // LTV = ($100 × 0.75) / 0.025 = $3,000
      const ltvResult = await calculator.calculateLTV({
        arpa: arpaResult,
        monthlyChurnRate,
        includeMargin: true,
        grossMargin,
      });

      expect(ltvResult).toEqual({
        amount: 300000, // $3,000
        currency: 'USD',
      });
    });
  });
});
