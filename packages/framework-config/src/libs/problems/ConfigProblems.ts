import { Problem, ProblemCategory } from '@croco/problems-core';

export class ConfigSchemaNotFoundProblem extends Problem {
  constructor(targetName: string) {
    super(
      'framework-config/config-schema-not-found',
      ProblemCategory.InternalServerError,
      `No config schema found for '${targetName}'`
    );
  }
}
