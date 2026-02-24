import { Problem, ProblemCategory } from '@croco/problems-core';

export class ApiKeyNotFoundProblem extends Problem {
  constructor(id: string) {
    super('API_KEY_NOT_FOUND', ProblemCategory.NotFound, `API Key with id '${id}' not found`);
  }
}
