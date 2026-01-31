import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidMeterProblem extends Problem {
  constructor(meterId: string, tenantId: string) {
    super('metering/invalid-meter', ProblemCategory.NotFound, `Meter '${meterId}' not found for tenant '${tenantId}'`, {
      extensions: {
        meterId,
        tenantId,
      },
    });
  }
}
