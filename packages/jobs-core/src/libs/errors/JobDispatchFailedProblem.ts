import { Problem, ProblemCategory } from '@croco/problems-core';

export class JobDispatchFailedProblem extends Problem {
  readonly code = 'JOB_DISPATCH_FAILED';
  readonly category = ProblemCategory.InternalServerError;

  constructor(jobName: string, reason?: string) {
    super(
      jobName,
      ProblemCategory.InternalServerError,
      `Failed to dispatch job '${jobName}'${reason ? `: ${reason}` : ''}`
    );
  }
}
