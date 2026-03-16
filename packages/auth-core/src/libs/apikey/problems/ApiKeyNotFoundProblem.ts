import { Problem, ProblemCategory } from '@croco/problems-core';

export class ApiKeyNotFoundProblem extends Problem {
  readonly code = 'API_KEY_NOT_FOUND';
  readonly category = ProblemCategory.NotFound;
  constructor(id: string) {
    super(`API Key with id '${id}' not found`);
  }
}
