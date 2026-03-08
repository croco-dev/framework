import { beforeEach, describe, expect, it } from 'vitest';
import { RetentionCalculator } from '../libs/RetentionCalculator';
import type { MRRMovement } from '../types';

describe('RetentionCalculator', () => {
  let calculator!: RetentionCalculator;

  beforeEach(() => {
    calculator = new RetentionCalculator();
  });

  const createMovement = (overrides?: Partial<MRRMovement>): MRRMovement => ({
    new: { amount: 10000, currency: 'USD' },
    expansion: { amount: 5000, currency: 'USD' },
    contraction: { amount: 2000, currency: 'USD' },
    churned: { amount: 3000, currency: 'USD' },
    reactivation: { amount: 1000, currency: 'USD' },
    net: { amount: 11000, currency: 'USD' },
    ...overrides,
  });

  describe('Fixture A: 안정적인 SaaS - GRR 95%, NRR 115%', () => {
    it('should calculate GRR as 95% for stable SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: 'USD' },
        expansion: { amount: 8000, currency: 'USD' },
        contraction: { amount: 2000, currency: 'USD' },
        churned: { amount: 3000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 19000, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(95);
    });

    it('should calculate NRR as 115% for stable SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: 'USD' },
        expansion: { amount: 8000, currency: 'USD' },
        contraction: { amount: 2000, currency: 'USD' },
        churned: { amount: 3000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 19000, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(103);
    });

    it('should calculate revenue churn as 3%', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        churned: { amount: 3000, currency: 'USD' },
      });

      const result = await calculator.calculateChurn(startingMRR, movement, 'revenue');

      expect(result).toBe(3);
    });
  });

  describe('Fixture B: 고성장 SaaS - GRR 92%, NRR 130%', () => {
    it('should calculate GRR as 92% for high-growth SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 25000, currency: 'USD' },
        expansion: { amount: 15000, currency: 'USD' },
        contraction: { amount: 3000, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 2000, currency: 'USD' },
        net: { amount: 34000, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(92);
    });

    it('should calculate NRR as 107% for high-growth SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 25000, currency: 'USD' },
        expansion: { amount: 15000, currency: 'USD' },
        contraction: { amount: 3000, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 2000, currency: 'USD' },
        net: { amount: 34000, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(107);
    });
  });

  describe('Fixture C: 위험한 SaaS - GRR 80%, NRR 85%', () => {
    it('should calculate GRR as 80% for at-risk SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: 'USD' },
        expansion: { amount: 3000, currency: 'USD' },
        contraction: { amount: 5000, currency: 'USD' },
        churned: { amount: 15000, currency: 'USD' },
        reactivation: { amount: 500, currency: 'USD' },
        net: { amount: -11500, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(80);
    });

    it('should calculate NRR as 83% for at-risk SaaS', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: 'USD' },
        expansion: { amount: 3000, currency: 'USD' },
        contraction: { amount: 5000, currency: 'USD' },
        churned: { amount: 15000, currency: 'USD' },
        reactivation: { amount: 500, currency: 'USD' },
        net: { amount: -11500, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(83);
    });
  });

  describe('Fixture D: 완벽한 보존 - GRR 100%, NRR 100%', () => {
    it('should calculate GRR as 100% when no churn or contraction', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 5000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 15000, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(100);
    });

    it('should calculate NRR as 105% with expansion only', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 5000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 15000, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(105);
    });
  });

  describe('Fixture E: 대규모 해지 - GRR 70%, NRR 75%', () => {
    it('should calculate GRR as 70% for massive churn', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: 'USD' },
        expansion: { amount: 2000, currency: 'USD' },
        contraction: { amount: 8000, currency: 'USD' },
        churned: { amount: 22000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -23000, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(70);
    });

    it('should calculate NRR as 72% for massive churn', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: 'USD' },
        expansion: { amount: 2000, currency: 'USD' },
        contraction: { amount: 8000, currency: 'USD' },
        churned: { amount: 22000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -23000, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(72);
    });
  });

  describe('calculateRetention: 모든 메트릭 한 번에 계산', () => {
    it('should return partial retention metrics when logo churn data is unavailable', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: 'USD' },
        expansion: { amount: 8000, currency: 'USD' },
        contraction: { amount: 2000, currency: 'USD' },
        churned: { amount: 3000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 19000, currency: 'USD' },
      });

      await expect(calculator.calculateRetention(startingMRR, movement)).resolves.toEqual({
        grr: 95,
        nrr: 103,
        logoChurn: null,
        revenueChurn: 3,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return null for zero starting MRR', async () => {
      const startingMRR = 0;
      const movement = createMovement();

      const grr = await calculator.calculateGRR(startingMRR, movement);
      const nrr = await calculator.calculateNRR(startingMRR, movement);
      const churn = await calculator.calculateChurn(startingMRR, movement, 'revenue');

      expect(grr).toBeNull();
      expect(nrr).toBeNull();
      expect(churn).toBeNull();
    });

    it('should throw error for logo churn type', async () => {
      const startingMRR = 100000;
      const movement = createMovement();

      await expect(calculator.calculateChurn(startingMRR, movement, 'logo')).rejects.toThrow(
        'Logo churn calculation requires customer count data'
      );
    });

    it('should cap GRR at 100% maximum', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 50000, currency: 'USD' },
        expansion: { amount: 20000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 70000, currency: 'USD' },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(100);
    });

    it('should allow NRR to exceed 100%', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 50000, currency: 'USD' },
        expansion: { amount: 20000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 70000, currency: 'USD' },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(120);
    });

    it('should handle negative ending MRR', async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 1000, currency: 'USD' },
        expansion: { amount: 0, currency: 'USD' },
        contraction: { amount: 10000, currency: 'USD' },
        churned: { amount: 95000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -104000, currency: 'USD' },
      });

      const grr = await calculator.calculateGRR(startingMRR, movement);
      const nrr = await calculator.calculateNRR(startingMRR, movement);
      expect(grr).toBe(-5);

      expect(nrr).toBe(-5);
    });
  });

  describe('Golden Fixture: 종합 시나리오', () => {
    it('should return partial retention results for complex scenario', async () => {
      const startingMRR = 50000;
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 7500, currency: 'USD' },
        contraction: { amount: 2500, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 1500, currency: 'USD' },
        net: { amount: 11500, currency: 'USD' },
      });

      await expect(calculator.calculateRetention(startingMRR, movement)).resolves.toEqual({
        grr: 85,
        nrr: 100,
        logoChurn: null,
        revenueChurn: 10,
      });
    });
  });
});
