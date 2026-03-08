import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircularDependencyProblem extends Problem {
  constructor(cycle: string[]) {
    super(
      'framework-context/circular-dependency',
      ProblemCategory.InternalServerError,
      `Circular dependency detected: ${cycle.join(' → ')}`
    );
  }
}
