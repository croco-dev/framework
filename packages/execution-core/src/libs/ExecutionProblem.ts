import { Problem, ProblemCategory } from "@croco/problems-core";

export enum ExecutionProblemCode {
  NOT_FOUND = "execution/not-found",
  CONFLICT = "execution/conflict",
  MAX_RETRIES_EXCEEDED = "execution/max-retries-exceeded",
  INVALID_STATE_TRANSITION = "execution/invalid-state-transition",
}

/**
 * Execution-specific Problem errors extending the base Problem class.
 */
export class ExecutionProblem extends Problem {
  // biome-ignore lint: base class Problem has protected constructor requiring explicit constructor
  constructor(code: ExecutionProblemCode, category: ProblemCategory, detail?: string) {
    super(code, category, detail);
  }
}

/**
 * Factory methods for creating ExecutionProblem instances.
 */
export class ExecutionProblems {
  static notFound(detail: string): ExecutionProblem {
    return new ExecutionProblem(ExecutionProblemCode.NOT_FOUND, ProblemCategory.NotFound, detail);
  }

  static conflict(detail: string): ExecutionProblem {
    return new ExecutionProblem(ExecutionProblemCode.CONFLICT, ProblemCategory.Conflict, detail);
  }

  static maxRetriesExceeded(detail: string): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.MAX_RETRIES_EXCEEDED,
      ProblemCategory.Conflict,
      detail,
    );
  }

  static invalidStateTransition(detail: string): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.INVALID_STATE_TRANSITION,
      ProblemCategory.Conflict,
      detail,
    );
  }
}
