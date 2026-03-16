import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircularDependencyProblem extends Problem {
  readonly code = 'framework-context/circular-dependency';
  readonly category = ProblemCategory.InternalServerError;
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
  }
}
