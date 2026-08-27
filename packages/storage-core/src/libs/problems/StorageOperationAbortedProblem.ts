import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "./StorageProblem";
import type { StorageOperation } from "../types";

/**
 * 호출자의 AbortSignal로 스토리지 연산이 취소되었을 때 발생하는 Problem입니다.
 */
export class StorageOperationAbortedProblem extends StorageProblem {
  readonly code = "STORAGE_OPERATION_ABORTED";

  constructor(operation: StorageOperation, key?: string, cause?: Error) {
    super(
      "STORAGE_OPERATION_ABORTED",
      ProblemCategory.BadRequest,
      key === undefined
        ? `Storage operation '${operation}' was aborted`
        : `Storage operation '${operation}' was aborted for key '${key}'`,
      {
        cause,
        extensions: key === undefined ? { operation } : { key, operation },
      },
    );
  }
}
