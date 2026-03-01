import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

export class DeleteFailedProblem extends StorageProblem {
  readonly code = 'STORAGE_DELETE_FAILED';

  constructor(key: string, cause?: unknown) {
    super('STORAGE_DELETE_FAILED', ProblemCategory.InternalServerError, `Failed to delete storage object '${key}'`, {
      cause: cause instanceof Error ? cause : undefined,
    });
  }
}
