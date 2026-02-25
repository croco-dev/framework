import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidIdPrefixProblem extends Problem {
  constructor(length: number, minimumLength: number) {
    super(
      'gid-core/invalid-id-prefix',
      ProblemCategory.ValidationError,
      `Prefix must be at least ${minimumLength} characters long, but got ${length}`
    );
  }
}
