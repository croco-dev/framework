import { Problem, ProblemCategory } from '@croco/problems-core';

export class CacheDecoratorConfigProblem extends Problem {
  readonly code = 'cache-core/invalid-decorator-config';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
