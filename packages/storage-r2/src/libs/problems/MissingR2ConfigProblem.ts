import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

export class MissingR2ConfigProblem extends StorageProblem {
  readonly code = 'STORAGE_R2_MISSING_CONFIG';
  readonly category = ProblemCategory.InternalServerError;

  constructor(configKey: string) {
    super(`Missing required R2 configuration: ${configKey}`);
  }
}
