import { Problem, ProblemCategory } from '@croco/problems-core';

export class SamplerProblem extends Problem {
  readonly code = 'TELEMETRY_SAMPLER_INVALID_CONFIG';
  readonly category = ProblemCategory.BadRequest;

  constructor(detail: string) {
    super(detail);
  }
}
