import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { TransactionContextProblem, TransactionDecoratorProblem } from '../libs/problems/TransactionProblems';

describe('TransactionProblems', () => {
  it('should create TransactionDecoratorProblem with expected metadata', () => {
    const problem = new TransactionDecoratorProblem();

    expect(problem.code).toBe('tx-core/decorator-misuse');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe('@Transactional can only be applied to methods');
  });

  it('should create TransactionContextProblem with expected metadata', () => {
    const problem = new TransactionContextProblem();

    expect(problem.code).toBe('tx-core/missing-transaction-context');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe('onAfterCommit must be called within a transaction');
  });
});
