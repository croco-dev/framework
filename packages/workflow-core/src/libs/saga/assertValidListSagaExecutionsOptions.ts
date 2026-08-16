import { SagaListPaginationProblem } from "../problems/WorkflowProblems";
import type { ListSagaExecutionsOptions } from "./types";

export function assertValidListSagaExecutionsOptions(
  options: ListSagaExecutionsOptions = {},
): void {
  if (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) {
    throw new SagaListPaginationProblem("offset", options.offset);
  }

  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new SagaListPaginationProblem("limit", options.limit);
  }
}
