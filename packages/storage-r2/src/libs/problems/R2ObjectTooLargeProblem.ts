import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

export class R2ObjectTooLargeProblem extends StorageProblem {
  readonly code = 'STORAGE_R2_OBJECT_TOO_LARGE';

  constructor(key: string, maxBytes: number) {
    super(
      'STORAGE_R2_OBJECT_TOO_LARGE',
      ProblemCategory.InternalServerError,
      `R2 object '${key}' exceeds the in-memory download limit of ${maxBytes} bytes`
    );
  }
}
