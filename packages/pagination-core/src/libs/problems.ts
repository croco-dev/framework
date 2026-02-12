import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidCursorProblem extends Problem {
  readonly code = 'INVALID_CURSOR';
  readonly category = ProblemCategory.BadRequest;

  constructor(detail?: string) {
    super('INVALID_CURSOR', ProblemCategory.BadRequest, detail ?? 'The provided cursor is invalid or malformed');
  }
}

export class ConflictingPaginationProblem extends Problem {
  readonly code = 'CONFLICTING_PAGINATION';
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(
      'CONFLICTING_PAGINATION',
      ProblemCategory.BadRequest,
      'Cannot use both cursor and offset pagination simultaneously'
    );
  }
}
