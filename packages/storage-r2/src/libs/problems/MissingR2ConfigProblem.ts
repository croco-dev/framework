import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

/**
 * 필수 R2 설정이 누락되었을 때 발생하는 문제입니다.
 */
export class MissingR2ConfigProblem extends StorageProblem {
  readonly code = "STORAGE_R2_MISSING_CONFIG";
  readonly category = ProblemCategory.InternalServerError;

  constructor(configKeys: string | readonly string[]) {
    const missingConfig = Array.isArray(configKeys) ? configKeys : [configKeys];

    super(undefined, undefined, `Missing required R2 configuration: ${missingConfig.join(", ")}`);
  }
}
