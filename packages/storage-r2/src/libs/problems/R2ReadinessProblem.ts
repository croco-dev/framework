import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

export type R2ReadinessProblemOptions = {
  readonly cause?: Error;
  readonly upstreamCode?: string;
  readonly upstreamStatus?: number;
};

/**
 * R2 readiness check가 upstream 실패를 감지했을 때 발생하는 문제입니다.
 */
export class R2ReadinessProblem extends StorageProblem {
  readonly code = "STORAGE_R2_READINESS_FAILED";
  readonly category = ProblemCategory.InternalServerError;

  constructor(options: R2ReadinessProblemOptions = {}) {
    super(
      "STORAGE_R2_READINESS_FAILED",
      ProblemCategory.InternalServerError,
      "Cloudflare R2 readiness check failed",
      {
        cause: options.cause,
        extensions: {
          ...(options.upstreamCode ? { upstreamCode: options.upstreamCode } : {}),
          ...(typeof options.upstreamStatus === "number"
            ? { upstreamStatus: options.upstreamStatus }
            : {}),
        },
      },
    );
  }
}
