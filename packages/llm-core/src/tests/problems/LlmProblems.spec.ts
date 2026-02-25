import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import {
  InvalidLlmResponseProblem,
  LlmProblem,
  LlmProviderNotFoundProblem,
  LlmRateLimitProblem,
  LlmServiceNotInitializedProblem,
  LlmTokenLimitExceededProblem,
} from '../../libs/problems/LlmProblems';

class TestLlmProblem extends LlmProblem {
  constructor(code: string, category: ProblemCategory, detail: string) {
    super(code, category, detail);
  }
}

describe('LlmProblems', () => {
  describe('LlmProblem', () => {
    it('should create base problem with correct properties', () => {
      const problem = new TestLlmProblem('CUSTOM_ERROR', ProblemCategory.InternalServerError, 'Test error message');

      expect(problem.code).toBe('CUSTOM_ERROR');
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.detail).toBe('Test error message');
      expect(problem.status).toBe(500);
    });

    it('should accept custom category', () => {
      const problem = new TestLlmProblem('CUSTOM_ERROR', ProblemCategory.NotFound, 'Not found');

      expect(problem.category).toBe(ProblemCategory.NotFound);
      expect(problem.status).toBe(404);
    });

    it('should convert to RFC 7807 format', () => {
      const problem = new TestLlmProblem('CUSTOM_ERROR', ProblemCategory.InternalServerError, 'Test error');
      const json = problem.toJSON();

      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json.title).toBe('Internal Server Error');
      expect(json).toHaveProperty('status', 500);
      expect(json).toHaveProperty('code', 'CUSTOM_ERROR');
      expect(json).toHaveProperty('detail', 'Test error');
    });
  });

  describe('LlmProviderNotFoundProblem', () => {
    it('should create problem with provider info', () => {
      const problem = new LlmProviderNotFoundProblem('openai');

      expect(problem.code).toBe('LLM_PROVIDER_NOT_FOUND');
      expect(problem.category).toBe(ProblemCategory.NotFound);
      expect(problem.detail).toContain('openai');
      expect(problem.status).toBe(404);
    });

    it('should have correct error message format', () => {
      const problem = new LlmProviderNotFoundProblem('anthropic');

      expect(problem.detail).toBe('LLM provider not found: anthropic');
    });

    it('should convert to problem details', () => {
      const problem = new LlmProviderNotFoundProblem('custom-provider');
      const json = problem.toJSON();

      expect(json.code).toBe('LLM_PROVIDER_NOT_FOUND');
      expect(json.status).toBe(404);
      expect(json.detail).toContain('custom-provider');
    });
  });

  describe('LlmTokenLimitExceededProblem', () => {
    it('should create problem with limit details', () => {
      const problem = new LlmTokenLimitExceededProblem(100000, 150000);

      expect(problem.code).toBe('TOKEN_LIMIT_EXCEEDED');
      expect(problem.category).toBe(ProblemCategory.BadRequest);
      expect(problem.status).toBe(400);
      expect(problem.detail).toContain('100000');
      expect(problem.detail).toContain('150000');
    });

    it('should have correct error message format', () => {
      const problem = new LlmTokenLimitExceededProblem(8000, 10000);

      expect(problem.detail).toBe('Token limit exceeded: 8000 (limit) < 10000 (requested)');
    });

    it('should include limit info in extensions', () => {
      const problem = new LlmTokenLimitExceededProblem(5000, 7000);
      const json = problem.toJSON();

      expect(json.limit).toBe(5000);
      expect(json.requested).toBe(7000);
    });
  });

  describe('LlmRateLimitProblem', () => {
    it('should create problem with retry info', () => {
      const problem = new LlmRateLimitProblem(60, '2024-01-01T12:00:00Z');

      expect(problem.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(problem.category).toBe(ProblemCategory.TooManyRequests);
      expect(problem.status).toBe(429);
      expect(problem.detail).toContain('60');
    });

    it('should handle missing retry-after date', () => {
      const problem = new LlmRateLimitProblem(30);

      expect(problem.detail).toBe('Rate limit exceeded. Retry after 30 seconds');
    });

    it('should include retry info in extensions', () => {
      const problem = new LlmRateLimitProblem(120, '2024-01-01T12:05:00Z');
      const json = problem.toJSON();

      expect(json.retryAfter).toBe(120);
      expect(json.retryAt).toBe('2024-01-01T12:05:00Z');
    });

    it('should not include retryAt if not provided', () => {
      const problem = new LlmRateLimitProblem(45);
      const json = problem.toJSON();

      expect(json.retryAfter).toBe(45);
      expect(json.retryAt).toBeUndefined();
    });
  });

  describe('InvalidLlmResponseProblem', () => {
    it('should create problem with correct code and category', () => {
      const problem = new InvalidLlmResponseProblem('not-json');

      expect(problem.code).toBe('llm-core/invalid-llm-response');
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.detail).toBe('Invalid JSON response: not-json');
      expect(problem.status).toBe(500);
    });
  });

  describe('LlmServiceNotInitializedProblem', () => {
    it('should create problem with correct code and category', () => {
      const problem = new LlmServiceNotInitializedProblem();

      expect(problem.code).toBe('llm-core/llm-service-not-initialized');
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.detail).toBe('LlmService not initialized. Call setLlmService() first.');
      expect(problem.status).toBe(500);
    });
  });
});
