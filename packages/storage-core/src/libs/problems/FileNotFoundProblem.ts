import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

/**
 * 파일을 찾을 수 없을 때 발생하는 Problem (404)
 */
export class FileNotFoundProblem extends StorageProblem {
  readonly code = 'STORAGE_FILE_NOT_FOUND';

  constructor(key: string, cause?: Error) {
    super('STORAGE_FILE_NOT_FOUND', ProblemCategory.NotFound, `File with key '${key}' not found`, {
      cause,
    });
  }
}
