import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { TxManagerNotRegisteredError, TxPropagationError } from '../libs/errors';
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

  it('should create TxManagerNotRegisteredError with expected metadata', () => {
    const error = new TxManagerNotRegisteredError('my-db');

    expect(error.code).toBe('tx-core/manager-not-registered');
    expect(error.category).toBe(ProblemCategory.InternalServerError);
    expect(error.detail).toBe('TxManager not registered for key: my-db');
  });

  it('should create TxPropagationError with expected metadata', () => {
    const error = new TxPropagationError('propagation failed');

    expect(error.code).toBe('tx-core/propagation-error');
    expect(error.category).toBe(ProblemCategory.BusinessRuleViolation);
    expect(error.detail).toBe('propagation failed');
  });
});
