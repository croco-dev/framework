import { Problem, ProblemCategory } from '@croco/problems-core';

export class TxManagerNotRegisteredError extends Problem {
  constructor(key: string) {
    super(
      'tx-core/manager-not-registered',
      ProblemCategory.InternalServerError,
      `TxManager not registered for key: ${key}`
    );
  }
}

export class TxPropagationError extends Problem {
  constructor(message: string) {
    super('tx-core/propagation-error', ProblemCategory.BusinessRuleViolation, message);
  }
}
