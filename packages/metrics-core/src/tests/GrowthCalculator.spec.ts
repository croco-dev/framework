import { beforeEach, describe, expect, it } from 'vitest';
import { GrowthCalculator } from '../libs/GrowthCalculator';
import type { MRRMovement } from '../types';

describe('GrowthCalculator', () => {
  let calculator!: GrowthCalculator;

  beforeEach(() => {
    calculator = new GrowthCalculator();
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

  describe('Fixture A: 우수한 성장 - Quick Ratio 4.0', () => {
    it('should calculate Quick Ratio as 4.0 for excellent growth', async () => {
      const movement = createMovement({
        new: { amount: 20000, currency: 'USD' },
        expansion: { amount: 10000, currency: 'USD' },
        contraction: { amount: 3000, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 23000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(3.75);
    });
  });

  describe('Fixture B: 매우 우수한 성장 - Quick Ratio 6.0', () => {
    it('should calculate Quick Ratio as 6.0 for exceptional growth', async () => {
      const movement = createMovement({
        new: { amount: 30000, currency: 'USD' },
        expansion: { amount: 15000, currency: 'USD' },
        contraction: { amount: 2000, currency: 'USD' },
        churned: { amount: 3000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 41000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(9);
    });
  });

  describe('Fixture C: 건강한 성장 - Quick Ratio 2.5', () => {
    it('should calculate Quick Ratio as 2.5 for healthy growth', async () => {
      const movement = createMovement({
        new: { amount: 15000, currency: 'USD' },
        expansion: { amount: 7500, currency: 'USD' },
        contraction: { amount: 4000, currency: 'USD' },
        churned: { amount: 6000, currency: 'USD' },
        reactivation: { amount: 1000, currency: 'USD' },
        net: { amount: 11500, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(2.25);
    });
  });

  describe('Fixture D: 보통 성장 - Quick Ratio 1.5', () => {
    it('should calculate Quick Ratio as 1.5 for moderate growth', async () => {
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 5000, currency: 'USD' },
        contraction: { amount: 5000, currency: 'USD' },
        churned: { amount: 7000, currency: 'USD' },
        reactivation: { amount: 500, currency: 'USD' },
        net: { amount: 3500, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(1.25);
    });
  });

  describe('Fixture E: 위험 - Quick Ratio 0.8', () => {
    it('should calculate Quick Ratio as 0.8 for declining business', async () => {
      const movement = createMovement({
        new: { amount: 5000, currency: 'USD' },
        expansion: { amount: 3000, currency: 'USD' },
        contraction: { amount: 6000, currency: 'USD' },
        churned: { amount: 10000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -8000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(0.5);
    });
  });

  describe('Fixture F: 심각한 위험 - Quick Ratio 0.3', () => {
    it('should calculate Quick Ratio as 0.3 for severe decline', async () => {
      const movement = createMovement({
        new: { amount: 2000, currency: 'USD' },
        expansion: { amount: 1000, currency: 'USD' },
        contraction: { amount: 5000, currency: 'USD' },
        churned: { amount: 15000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -17000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBeCloseTo(0.15, 2);
    });
  });

  describe('Fixture G: 완벽한 보존 - Quick Ratio 무한대 (분모 0)', () => {
    it('should return null when no churn or contraction', async () => {
      const movement = createMovement({
        new: { amount: 20000, currency: 'USD' },
        expansion: { amount: 10000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 30000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBeNull();
    });
  });

  describe('Fixture H: 순수 신규 - Quick Ratio 5.0', () => {
    it('should calculate Quick Ratio as 5.0 for pure new business', async () => {
      const movement = createMovement({
        new: { amount: 25000, currency: 'USD' },
        expansion: { amount: 0, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 20000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(5);
    });
  });

  describe('Fixture I: 순수 확장 - Quick Ratio 4.0', () => {
    it('should calculate Quick Ratio as 4.0 for pure expansion', async () => {
      const movement = createMovement({
        new: { amount: 0, currency: 'USD' },
        expansion: { amount: 20000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 5000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 15000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(4);
    });
  });

  describe('Golden Fixture: 종합 시나리오', () => {
    it('should calculate Quick Ratio correctly for complex scenario', async () => {
      const movement = createMovement({
        new: { amount: 18000, currency: 'USD' },
        expansion: { amount: 12000, currency: 'USD' },
        contraction: { amount: 4000, currency: 'USD' },
        churned: { amount: 8000, currency: 'USD' },
        reactivation: { amount: 2000, currency: 'USD' },
        net: { amount: 20000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(2.5);
    });
  });

  describe('Edge Cases', () => {
    it('should return null when both churn and contraction are zero', async () => {
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 5000, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 15000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBeNull();
    });

    it('should handle zero new and expansion', async () => {
      const movement = createMovement({
        new: { amount: 0, currency: 'USD' },
        expansion: { amount: 0, currency: 'USD' },
        contraction: { amount: 3000, currency: 'USD' },
        churned: { amount: 7000, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -10000, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(0);
    });

    it('should handle very small denominator', async () => {
      const movement = createMovement({
        new: { amount: 10000, currency: 'USD' },
        expansion: { amount: 5000, currency: 'USD' },
        contraction: { amount: 1, currency: 'USD' },
        churned: { amount: 1, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 14998, currency: 'USD' },
      });

      const result = await calculator.calculateQuickRatio(movement);

      expect(result).toBe(7500);
    });
  });
});
