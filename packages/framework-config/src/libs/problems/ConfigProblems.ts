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

export class ConfigValidationProblem extends Problem {
  constructor(missingPaths: string[]) {
    const missing = missingPaths.join(', ');

    super('framework-config/config-validation-failed', ProblemCategory.ValidationError, `Missing required: ${missing}`);
  }
}
