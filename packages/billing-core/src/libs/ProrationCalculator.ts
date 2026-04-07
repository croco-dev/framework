import type { Plan } from '../types';
import type { Money } from './Money';

export type ProrationCalculationParams = {
  currentPlan: Plan;
  nextPlan: Plan;
  periodStart: Date;
  periodEnd: Date;
  changeAt: Date;
  quantity?: number;
};

export type ProrationCalculation = {
  credit: Money;
  charge: Money;
  netAmount: Money;
  usedRatio: number;
  remainingRatio: number;
};

export interface ProrationCalculator {
  calculate(params: ProrationCalculationParams): Promise<ProrationCalculation>;
}
