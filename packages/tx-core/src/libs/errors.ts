import { Problem, ProblemCategory } from '@croco/problems-core';

export class DuplicateTxManagerRegistrationProblem extends Problem {
  readonly code = 'tx-core/duplicate-tx-manager-registration';
  readonly category = ProblemCategory.InternalServerError;

  constructor(key: string | undefined) {
    super(undefined, undefined, `TxManager is already registered for key: '${String(key ?? 'default')}'`);
  }
}

export class TxManagerNotRegisteredError extends Problem {
  readonly code = 'tx-core/manager-not-registered';
  readonly category = ProblemCategory.InternalServerError;
  constructor(key: string) {
    super(undefined, undefined, `TxManager not registered for key: ${key}`);
  }
}

export class TxPropagationError extends Problem {
  readonly code = 'tx-core/propagation-error';
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(message: string) {
    super(undefined, undefined, message);
  }
}
