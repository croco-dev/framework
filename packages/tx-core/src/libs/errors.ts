import { Problem, ProblemCategory } from '@croco/problems-core';

export class TxManagerNotRegisteredError extends Problem {
  readonly code = 'tx-core/manager-not-registered';
  readonly category = ProblemCategory.InternalServerError;
  constructor(key: string) {
    super(`TxManager not registered for key: ${key}`);
  }
}

export class TxPropagationError extends Problem {
  readonly code = 'tx-core/propagation-error';
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(message: string) {
    super(message);
  }
}
