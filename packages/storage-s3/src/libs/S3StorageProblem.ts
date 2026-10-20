import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

/** A redacted S3 failure. Upstream messages and credentials are never public details. */
export class S3StorageProblem extends StorageProblem {
  readonly code = "STORAGE_S3_FAILED";

  constructor(
    readonly operation: string,
    options: { cleanupFailed?: boolean; cause?: unknown } = {},
  ) {
    super("STORAGE_S3_FAILED", ProblemCategory.InternalServerError, `S3 ${operation} failed`, {
      cause: options.cause instanceof Error ? options.cause : undefined,
      extensions: { details: { operation, cleanupFailed: options.cleanupFailed ?? false } },
    });
  }
}
