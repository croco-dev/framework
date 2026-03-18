import { Problem, ProblemCategory } from '@croco/problems-core';

export class SamplerProblem extends Problem {
  readonly code = 'TELEMETRY_SAMPLER_INVALID_CONFIG';
  readonly category = ProblemCategory.BadRequest;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

export class OtlpEndpointRequiredProblem extends Problem {
  readonly code = 'OTLP_ENDPOINT_REQUIRED';
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super('OTLP endpoint is required for telemetry');
  }
}
