import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

export class EmptyR2BodyProblem extends StorageProblem {
  constructor(key: string) {
    super('STORAGE_R2_EMPTY_BODY', ProblemCategory.InternalServerError, 'Empty response body', {
      extensions: { key },
    });
  }
}
