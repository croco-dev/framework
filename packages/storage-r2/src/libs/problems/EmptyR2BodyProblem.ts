import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

/**
 * R2 다운로드 응답에 본문이 없을 때 발생하는 문제입니다.
 */
export class EmptyR2BodyProblem extends StorageProblem {
  constructor(key: string) {
    super("STORAGE_R2_EMPTY_BODY", ProblemCategory.InternalServerError, "Empty response body", {
      extensions: { key },
    });
  }
}
