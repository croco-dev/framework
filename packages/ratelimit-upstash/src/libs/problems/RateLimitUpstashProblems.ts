import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidRateLimitPolicyProblem extends Problem {
  readonly code = 'ratelimit-upstash/invalid-policy';
  readonly category = ProblemCategory.InternalServerError;

  constructor(storeType: string) {
    super(undefined, undefined, `Invalid policy for ${storeType} store`);
  }
}
