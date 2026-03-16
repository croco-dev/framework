import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

export class InvalidKeyProblem extends StorageProblem {
  readonly code = 'STORAGE_INVALID_KEY';
  readonly category = ProblemCategory.BadRequest;

  constructor(key: string, reason?: string) {
    super(undefined, undefined, reason ? `Invalid storage key '${key}': ${reason}` : `Invalid storage key '${key}'`);
  }
}
