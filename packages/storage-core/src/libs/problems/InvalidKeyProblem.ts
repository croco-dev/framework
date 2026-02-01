import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

/**
 * 유효하지 않은 키일 때 발생하는 Problem
 */
export class InvalidKeyProblem extends StorageProblem {
  readonly code = 'STORAGE_INVALID_KEY';

  constructor(key: string, reason?: string) {
    super(
      'STORAGE_INVALID_KEY',
      ProblemCategory.BadRequest,
      reason ? `Invalid storage key '${key}': ${reason}` : `Invalid storage key '${key}'`
    );
  }
}
