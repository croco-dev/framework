import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * graceful shutdown이 제한 시간을 넘겼을 때 발생하는 Problem입니다.
 */
export class ShutdownTimeoutProblem extends Problem {
  readonly code = 'framework-context/shutdown-timeout';
  readonly category = ProblemCategory.InternalServerError;
  constructor(timeoutMs: number) {
    super(undefined, undefined, `Shutdown timeout exceeded after ${timeoutMs}ms`);
  }
}
