import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

export class DeleteFailedProblem extends StorageProblem {
  readonly code = 'STORAGE_DELETE_FAILED';

  constructor(key: string, cause?: unknown) {
    super('STORAGE_DELETE_FAILED', ProblemCategory.InternalServerError, `Failed to delete storage object '${key}'`);
    if (cause instanceof Error) {
      (this as unknown as { cause: Error }).cause = cause;
    }
  }
}
