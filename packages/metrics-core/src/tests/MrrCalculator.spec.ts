import { beforeEach, describe, expect, it } from 'vitest';
import type { PlanProvider } from '../libs/interfaces/PlanProvider';
import { MrrCalculator } from '../libs/MrrCalculator';
import type { PlanSnapshot, SubscriptionSnapshot } from '../types';

describe('MrrCalculator', () => {
  let calculator!: MrrCalculator;
  let mockPlanProvider!: PlanProvider;

  beforeEach(() => {
    calculator = new MrrCalculator();

    mockPlanProvider = {
      getPlan: async (planId: string) => {
        const plans: Record<string, PlanSnapshot> = {
          plan_monthly_10: {
            id: 'plan_monthly_10',
            amount: 1000,
            currency: 'USD',
            interval: 'month',
            intervalCount: 1,
          },
          plan_monthly_20: {
            id: 'plan_monthly_20',
            amount: 2000,
            currency: 'USD',
            interval: 'month',
            intervalCount: 1,
          },
          plan_yearly_120: {
            id: 'plan_yearly_120',
            amount: 12000,
            currency: 'USD',
            interval: 'year',
            intervalCount: 1,
          },
          plan_monthly_5: {
            id: 'plan_monthly_5',
            amount: 500,
            currency: 'USD',
            interval: 'month',
            intervalCount: 1,
          },
        };
        return plans[planId] ?? null;
      },
    };
  });

  describe('Fixture A: 신규 구독 3개 → New MRR 계산', () => {
    it('should calculate total MRR from 3 new monthly subscriptions', async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: 'sub_1',
          planId: 'plan_monthly_10',
        },
        {
          id: 'sub_2',
          planId: 'plan_monthly_20',
        },
        {
          id: 'sub_3',
          planId: 'plan_monthly_10',
        },
      ];

      const result = await calculator.calculateMRR(subscriptions, mockPlanProvider);

      expect(result).toEqual({
        amount: 4000,
        currency: 'USD',
      });
    });
  });

  describe('Fixture B: 업그레이드 1개 → Expansion MRR', () => {
    it('should classify upgrade from $10 to $20 as expansion', () => {
      const result = calculator.classifyMRRMovement(true, false, 1000, 2000);

      expect(result).toBe('expansion');
    });
  });

  describe('Fixture C: 다운그레이드 1개 → Contraction MRR', () => {
    it('should classify downgrade from $20 to $5 as contraction', () => {
      const result = calculator.classifyMRRMovement(true, false, 2000, 500);

      expect(result).toBe('contraction');
    });
  });

  describe('Fixture D: 해지 1개 → Churned MRR', () => {
    it('should classify first subscription as new business', () => {
      const result = calculator.classifyMRRMovement(false, false, null, 1000);

      expect(result).toBe('new');
    });

    it('should classify reactivation after churn correctly', () => {
      const result = calculator.classifyMRRMovement(true, true, 1000, 1000);

      expect(result).toBe('reactivation');
    });
  });

  describe('Fixture E: 재구독 1개 → Reactivation MRR', () => {
    it('should classify returning customer as reactivation', () => {
      const wasChurned = true;
      const hasPreviousSubscription = true;

      const result = calculator.classifyMRRMovement(hasPreviousSubscription, wasChurned, 1000, 2000);

      expect(result).toBe('reactivation');
    });
  });

  describe('normalizeMRR', () => {
    it('should keep monthly plans as-is', () => {
      const result = calculator.normalizeMRR(1000, 'month', 1);
      expect(result).toBe(1000);
    });

    it('should normalize yearly plans to monthly', () => {
      const result = calculator.normalizeMRR(12000, 'year', 1);
      expect(result).toBe(1000);
    });

    it('should handle intervalCount correctly for monthly', () => {
      const result = calculator.normalizeMRR(3000, 'month', 3);
      expect(result).toBe(1000);
    });

    it('should handle intervalCount correctly for yearly', () => {
      const result = calculator.normalizeMRR(24000, 'year', 2);
      expect(result).toBe(1000);
    });
  });

  describe('Golden Fixture: MRR 계산 시나리오 종합 테스트', () => {
    it('should calculate MRR correctly with mixed monthly and yearly plans', async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: 'sub_1',
          planId: 'plan_monthly_10',
        },
        {
          id: 'sub_2',
          planId: 'plan_yearly_120',
        },
        {
          id: 'sub_3',
          planId: 'plan_monthly_20',
        },
      ];

      const result = await calculator.calculateMRR(subscriptions, mockPlanProvider);

      expect(result).toEqual({
        amount: 4000,
        currency: 'USD',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty subscriptions list', async () => {
      const result = await calculator.calculateMRR([], mockPlanProvider);
      expect(result).toEqual({
        amount: 0,
        currency: 'USD',
      });
    });

    it('should skip subscriptions with unknown plans', async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: 'sub_1',
          planId: 'unknown_plan',
        },
      ];

      const result = await calculator.calculateMRR(subscriptions, mockPlanProvider);
      expect(result.amount).toBe(0);
    });

    it('should classify equal amounts as unchanged', () => {
      const result = calculator.classifyMRRMovement(true, false, 1000, 1000);

      expect(result).toBe('unchanged');
    });

    it('should handle null previous amount as new', () => {
      const result = calculator.classifyMRRMovement(true, false, null, 1000);

      expect(result).toBe('new');
    });
  });
});
