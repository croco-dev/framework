import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { InvalidWebhookPayloadProblem, WebhookVerificationProblem } from '../libs/problems/ClerkProblems';

describe('ClerkProblems', () => {
  describe('WebhookVerificationProblem', () => {
    it('has correct code and category', () => {
      const problem = new WebhookVerificationProblem();

      expect(problem.code).toBe('auth-clerk/webhook-verification-failed');
      expect(problem.category).toBe(ProblemCategory.Unauthorized);
    });
  });

  describe('InvalidWebhookPayloadProblem', () => {
    it('has correct code and category', () => {
      const problem = new InvalidWebhookPayloadProblem();

      expect(problem.code).toBe('auth-clerk/invalid-webhook-payload');
      expect(problem.category).toBe(ProblemCategory.ValidationError);
    });

    it('includes event type in detail when provided', () => {
      const problem = new InvalidWebhookPayloadProblem('user.created');

      expect(problem.detail).toContain('user.created');
    });
  });
});
