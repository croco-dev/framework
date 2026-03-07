import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import {
  ClerkTokenVerificationProblem,
  InvalidWebhookPayloadProblem,
  WebhookVerificationProblem,
} from '../libs/problems/ClerkProblems';

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

  describe('ClerkTokenVerificationProblem', () => {
    it('has correct code and category', () => {
      const problem = new ClerkTokenVerificationProblem();

      expect(problem.code).toBe('auth-clerk/token-verification-failed');
      expect(problem.category).toBe(ProblemCategory.Unauthorized);
    });

    it('uses the provided detail message', () => {
      const problem = new ClerkTokenVerificationProblem('jwt expired');

      expect(problem.detail).toBe('jwt expired');
    });
  });
});
