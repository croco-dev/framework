import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it, vi } from 'vitest';
import { RateLimitExceededProblem } from '../libs/problems/RateLimitExceededProblem';
import type { RateLimitResult } from '../libs/types';

describe('RateLimitExceededProblem', () => {
  const createResult = (resetAtMs: number): RateLimitResult => ({
    success: false,
    limit: 100,
    remaining: 0,
    resetAtMs,
  });

  it('should have correct code and category', () => {
    const result = createResult(Date.now() + 60000);
    const problem = new RateLimitExceededProblem(result);

    expect(problem.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(problem.category).toBe(ProblemCategory.TooManyRequests);
  });

  it('should calculate retryAfterMs correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-29T12:00:00.000Z'));

    const resetAt = new Date('2025-01-29T12:01:00.000Z').getTime();
    const result = createResult(resetAt);
    const problem = new RateLimitExceededProblem(result);

    expect(problem.retryAfterMs).toBe(60000);
    expect(problem.retryAfterSeconds).toBe(60);

    vi.useRealTimers();
  });

  it('should have rate limit extensions', () => {
    const resetAtMs = Date.now() + 30000;
    const result = createResult(resetAtMs);
    const problem = new RateLimitExceededProblem(result);

    expect(problem.extensions).toMatchObject({
      limit: 100,
      remaining: 0,
    });
    expect(problem.extensions?.resetAt).not.toBeUndefined();
    expect(problem.extensions?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should handle already expired reset time', () => {
    const result = createResult(Date.now() - 1000);
    const problem = new RateLimitExceededProblem(result);

    expect(problem.retryAfterMs).toBe(0);
    expect(problem.retryAfterSeconds).toBe(0);
  });

  it('should have descriptive detail message', () => {
    const result = createResult(Date.now() + 60000);
    const problem = new RateLimitExceededProblem(result);

    expect(problem.detail).toContain('Rate limit exceeded');
  });
});
