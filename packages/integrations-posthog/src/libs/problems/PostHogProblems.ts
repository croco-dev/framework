import { Problem, ProblemCategory } from '@croco/problems-core';

export class PostHogConfigProblem extends Problem {
  readonly code = 'integrations-posthog/missing-config';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
