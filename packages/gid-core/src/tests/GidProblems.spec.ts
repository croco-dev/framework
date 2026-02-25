import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { InvalidIdPrefixProblem } from '../libs/problems/GidProblems';

describe('GidProblems', () => {
  it('InvalidIdPrefixProblem has correct code and category', () => {
    const problem = new InvalidIdPrefixProblem(2, 3);

    expect(problem.code).toBe('gid-core/invalid-id-prefix');
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe('Prefix must be at least 3 characters long, but got 2');
  });
});
