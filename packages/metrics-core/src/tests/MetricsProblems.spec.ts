import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import {
  CarryingCapacitySimulationProblem,
  LogoChurnDataRequiredProblem,
  RetentionMetricsUnavailableProblem,
} from '../libs/problems/MetricsProblems';

describe('MetricsProblems', () => {
  it('LogoChurnDataRequiredProblem has correct code and category', () => {
    const problem = new LogoChurnDataRequiredProblem();

    expect(problem.code).toBe('metrics-core/logo-churn-data-required');
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe('Logo churn calculation requires customer count data');
  });

  it('CarryingCapacitySimulationProblem has correct code and category', () => {
    const problem = new CarryingCapacitySimulationProblem('Simulated churn rate is zero → infinite capacity');

    expect(problem.code).toBe('metrics-core/carrying-capacity-simulation-error');
    expect(problem.category).toBe(ProblemCategory.BusinessRuleViolation);
    expect(problem.detail).toBe('Simulated churn rate is zero → infinite capacity');
  });

  it('RetentionMetricsUnavailableProblem has correct code and category', () => {
    const problem = new RetentionMetricsUnavailableProblem();

    expect(problem.code).toBe('metrics-core/retention-metrics-unavailable');
    expect(problem.category).toBe(ProblemCategory.NotImplemented);
    expect(problem.detail).toBe('Retention metrics are not available until full retention calculation is implemented');
  });
});
