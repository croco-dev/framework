import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * 미들웨어 실행 흐름에서 문제가 발생했을 때 사용하는 Problem입니다.
 */
export class MiddlewareProblem extends Problem {
  readonly code = 'MIDDLEWARE_EXECUTION_ERROR';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
