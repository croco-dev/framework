import { Problem, ProblemCategory } from '@croco/problems-core';

export class JobNotFoundProblem extends Problem {
  readonly code = 'JOB_NOT_FOUND';
  readonly category = ProblemCategory.NotFound;

  constructor(jobName: string) {
    super(jobName, ProblemCategory.NotFound, `Job '${jobName}' not found in registry`);
  }
}
