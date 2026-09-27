import { IdempotencyProcessingLeaseUnsupportedProblem } from "./problems/IdempotencyProblems";
import type { IdempotencyStore, LeaseAwareIdempotencyStore } from "./types";

export function assertProcessingLeaseStore<TResult>(
  store: IdempotencyStore<TResult>,
): asserts store is LeaseAwareIdempotencyStore<TResult> {
  if (store.processingLeaseVersion !== 1) {
    throw new IdempotencyProcessingLeaseUnsupportedProblem();
  }
}
