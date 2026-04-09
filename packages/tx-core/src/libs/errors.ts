import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * 동일한 키에 트랜잭션 매니저를 중복 등록할 때 발생하는 Problem입니다.
 */
export class DuplicateTxManagerRegistrationProblem extends Problem {
  readonly code = 'tx-core/duplicate-tx-manager-registration';
  readonly category = ProblemCategory.InternalServerError;

  constructor(key: string | undefined) {
    super(undefined, undefined, `TxManager is already registered for key: ${String(key ?? 'default')}`);
  }
}

/**
 * 요청한 트랜잭션 매니저가 레지스트리에 없을 때 발생하는 Problem입니다.
 */
export class TxManagerNotRegisteredError extends Problem {
  readonly code = 'tx-core/manager-not-registered';
  readonly category = ProblemCategory.InternalServerError;
  constructor(key: string) {
    super(undefined, undefined, `TxManager not registered for key: ${key}`);
  }
}

/**
 * 전파 규칙이 현재 실행 환경과 맞지 않을 때 발생하는 Problem입니다.
 */
export class TxPropagationError extends Problem {
  readonly code = 'tx-core/propagation-error';
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(message: string) {
    super(undefined, undefined, message);
  }
}
