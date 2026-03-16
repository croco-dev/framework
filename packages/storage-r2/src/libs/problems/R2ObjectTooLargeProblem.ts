import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

export class R2ObjectTooLargeProblem extends StorageProblem {
  readonly code = 'STORAGE_R2_OBJECT_TOO_LARGE';
  readonly category = ProblemCategory.InternalServerError;

  constructor(key: string, maxBytes: number) {
    super(undefined, undefined, `R2 object '${key}' exceeds the in-memory download limit of ${maxBytes} bytes`);
  }
}
