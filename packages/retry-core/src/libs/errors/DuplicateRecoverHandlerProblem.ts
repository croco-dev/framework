import { Problem, ProblemCategory } from '@croco/problems-core';

export class DuplicateRecoverHandlerProblem extends Problem {
  readonly code = 'DUPLICATE_RECOVER_HANDLER';
  readonly category = ProblemCategory.InternalServerError;

  constructor(methodName: string, exceptionTypeName: string) {
    super(
      'DUPLICATE_RECOVER_HANDLER',
      ProblemCategory.InternalServerError,
      `Duplicate recover handler detected for '${exceptionTypeName}' on method '${methodName}'`
    );
  }
}
