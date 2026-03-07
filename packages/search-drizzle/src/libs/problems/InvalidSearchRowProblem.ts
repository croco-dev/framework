import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidSearchRowProblem extends Problem {
  constructor() {
    super(
      'SEARCH_DRIZZLE_INVALID_ROW',
      ProblemCategory.InternalServerError,
      'Invalid search row: expected object result'
    );
  }
}
