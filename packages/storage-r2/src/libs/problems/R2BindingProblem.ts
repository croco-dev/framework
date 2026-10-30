import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";
import type { StorageOperation } from "@croco/storage-core";

/** A binding failure has no documented retry classification or guaranteed remote rollback. */
export class R2BindingProblem extends StorageProblem {
  readonly code = "STORAGE_R2_BINDING_FAILED";

  constructor(operation: StorageOperation, cause: unknown) {
    super(
      "STORAGE_R2_BINDING_FAILED",
      ProblemCategory.InternalServerError,
      `R2 binding operation '${operation}' failed; inspect the cause before retrying`,
      {
        cause: cause instanceof Error ? cause : undefined,
        extensions: { operation },
      },
    );
  }
}
