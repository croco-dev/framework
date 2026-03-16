import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

export class MissingR2ConfigProblem extends StorageProblem {
  readonly code = 'STORAGE_R2_MISSING_CONFIG';
  readonly category = ProblemCategory.InternalServerError;

  constructor(configKey: string) {
    super(undefined, undefined, `Missing required R2 configuration: ${configKey}`);
  }
}
