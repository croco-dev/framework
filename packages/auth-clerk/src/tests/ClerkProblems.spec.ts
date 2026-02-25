import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { WebhookVerificationProblem } from '../libs/problems/ClerkProblems';

describe('ClerkProblems', () => {
  describe('WebhookVerificationProblem', () => {
    it('has correct code and category', () => {
      const problem = new WebhookVerificationProblem();

      expect(problem.code).toBe('auth-clerk/webhook-verification-failed');
      expect(problem.category).toBe(ProblemCategory.Unauthorized);
    });
  });
});
