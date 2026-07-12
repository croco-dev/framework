import { Problem, ProblemCategory } from "@croco/problems-core";

export enum ExecutionProblemCode {
  NOT_FOUND = "execution/not-found",
  CONFLICT = "execution/conflict",
  MAX_RETRIES_EXCEEDED = "execution/max-retries-exceeded",
  INVALID_STATE_TRANSITION = "execution/invalid-state-transition",
  CONTINUATION_UNSUPPORTED = "execution/continuation-unsupported",
  CONTINUATION_CONFLICT = "execution/continuation-conflict",
}

export interface ExecutionContinuationConflictEvidence {
  currentWorkerId?: string;
  currentLeaseExpiresAt?: string;
  currentStatus?: string;
}

/**
 * Execution-specific Problem errors extending the base Problem class.
 */
export class ExecutionProblem extends Problem {
  readonly evidence?: ExecutionContinuationConflictEvidence;

  // biome-ignore lint: base class Problem has protected constructor requiring explicit constructor
  constructor(
    code: ExecutionProblemCode,
    category: ProblemCategory,
    detail?: string,
    evidence?: ExecutionContinuationConflictEvidence,
  ) {
    super(code, category, detail, evidence ? { extensions: { ...evidence } } : undefined);
    this.evidence = evidence;
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

  static continuationUnsupported(detail: string): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.CONTINUATION_UNSUPPORTED,
      ProblemCategory.InternalServerError,
      detail,
    );
  }

  static continuationConflict(
    detail: string,
    evidence?: ExecutionContinuationConflictEvidence,
  ): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.CONTINUATION_CONFLICT,
      ProblemCategory.Conflict,
      detail,
      evidence,
    );
  }
}
