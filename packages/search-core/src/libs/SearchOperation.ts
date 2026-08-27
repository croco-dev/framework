import { SearchOperationAbortedProblem } from "./problems/SearchProblems";

import type { SearchOperation, SearchOperationOptions } from "./types";

/**
 * 검색 I/O가 시작되기 전에 caller cancellation을 검증합니다.
 */
export function throwIfSearchOperationAborted(
  operation: SearchOperation,
  options?: SearchOperationOptions,
): void {
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new SearchOperationAbortedProblem(operation, signal.reason);
  }
}
