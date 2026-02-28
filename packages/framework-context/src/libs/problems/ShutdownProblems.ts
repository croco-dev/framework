import { Problem, ProblemCategory } from '@croco/problems-core';

export class ShutdownTimeoutProblem extends Problem {
  constructor(timeoutMs: number) {
    super(
      'framework-context/shutdown-timeout',
      ProblemCategory.InternalServerError,
      `Shutdown timeout exceeded after ${timeoutMs}ms`
    );
  }
}
