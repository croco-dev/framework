import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from './StorageProblem';

/**
 * 파일 업로드 실패 시 발생하는 Problem
 */
export class UploadFailedProblem extends StorageProblem {
  readonly code = 'STORAGE_UPLOAD_FAILED';

  constructor(key: string, reason?: string) {
    super(
      'STORAGE_UPLOAD_FAILED',
      ProblemCategory.InternalServerError,
      reason ? `Failed to upload file '${key}': ${reason}` : `Failed to upload file '${key}'`
    );
  }
}
