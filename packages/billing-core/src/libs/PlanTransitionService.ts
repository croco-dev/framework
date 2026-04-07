import type { Plan, Subscription } from '../types';
import type { ProrationCalculation } from './ProrationCalculator';

export type PlanTransitionParams = {
  subscription: Subscription;
  currentPlan: Plan;
  nextPlan: Plan;
  effectiveAt: Date;
};

export type PlanTransitionPreview = {
  currentPlan: Plan;
  nextPlan: Plan;
  effectiveAt: Date;
  proration: ProrationCalculation;
};

export interface PlanTransitionService {
  previewTransition(params: PlanTransitionParams): Promise<PlanTransitionPreview>;
  transitionPlan(params: PlanTransitionParams): Promise<Subscription>;
}
