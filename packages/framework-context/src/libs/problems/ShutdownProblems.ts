import { Problem, ProblemCategory } from '@croco/problems-core';

export class ShutdownTimeoutProblem extends Problem {
  readonly code = 'framework-context/shutdown-timeout';
  readonly category = ProblemCategory.InternalServerError;
  constructor(timeoutMs: number) {
    super(`Shutdown timeout exceeded after ${timeoutMs}ms`);
  }
}
