import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { TransactionStateProblem } from '../libs/problems/EventsTxProblems';

describe('EventsTxProblems', () => {
  it('should create TransactionStateProblem with expected metadata', () => {
    const problem = new TransactionStateProblem("Transaction 'tx-1' not found");

    expect(problem.code).toBe('events-tx/transaction-state-error');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Transaction 'tx-1' not found");
  });
});
