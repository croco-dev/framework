import { ProblemCategory } from '@croco/problems-core';
import { StorageProblem } from '@croco/storage-core';

/**
 * 메모리 기반 다운로드 한도를 초과한 객체를 읽으려 할 때 발생하는 문제입니다.
 */
export class R2ObjectTooLargeProblem extends StorageProblem {
  readonly code = 'STORAGE_R2_OBJECT_TOO_LARGE';
  readonly category = ProblemCategory.InternalServerError;

  constructor(key: string, maxBytes: number) {
    super(undefined, undefined, `R2 object '${key}' exceeds the in-memory download limit of ${maxBytes} bytes`);
  }
}
