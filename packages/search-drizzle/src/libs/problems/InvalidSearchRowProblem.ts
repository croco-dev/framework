import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidSearchRowProblem extends Problem {  readonly code = 'SEARCH_DRIZZLE_INVALID_ROW'; readonly category = ProblemCategory.InternalServerError; constructor() { super('Invalid search row: expected object result');  }  }
