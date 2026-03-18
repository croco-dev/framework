import { Problem, ProblemCategory } from '@croco/problems-core';

export class SamplerProblem extends Problem {
  readonly code = 'TELEMETRY_SAMPLER_INVALID_CONFIG';
  readonly category = ProblemCategory.BadRequest;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}
