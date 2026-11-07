import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

/** The S3-compatible API reported a missing configured bucket, rather than a missing object. */
export class R2BucketNotFoundProblem extends StorageProblem {
  readonly code = "STORAGE_R2_BUCKET_NOT_FOUND";
  readonly category = ProblemCategory.InternalServerError;

  constructor(cause: Error, upstreamStatus?: number) {
    super(
      "STORAGE_R2_BUCKET_NOT_FOUND",
      ProblemCategory.InternalServerError,
      "Configured R2 bucket does not exist; verify R2_BUCKET and the R2 account configuration",
      {
        cause,
        extensions: {
          retryable: false,
          upstreamCode: "NoSuchBucket",
          ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
        },
      },
    );
  }
}
