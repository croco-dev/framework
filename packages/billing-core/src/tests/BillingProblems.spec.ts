import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { BillingAccountNotFoundProblem, SubscriptionNotFoundProblem } from '../libs/problems/BillingProblems';

describe('BillingProblems', () => {
  describe('SubscriptionNotFoundProblem', () => {
    it('has correct code and category', () => {
      const problem = new SubscriptionNotFoundProblem('tenant-1');

      expect(problem.code).toBe('billing/subscription-not-found');
      expect(problem.category).toBe(ProblemCategory.NotFound);
    });
  });

  describe('BillingAccountNotFoundProblem', () => {
    it('has correct code and category', () => {
      const problem = new BillingAccountNotFoundProblem('tenant-1');

      expect(problem.code).toBe('billing/account-not-found');
      expect(problem.category).toBe(ProblemCategory.NotFound);
    });
  });
});
