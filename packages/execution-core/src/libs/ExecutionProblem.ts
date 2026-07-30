import { Problem, ProblemCategory } from "@croco/problems-core";

export enum ExecutionProblemCode {
  NOT_FOUND = "execution/not-found",
  CONFLICT = "execution/conflict",
  IDEMPOTENCY_CONFLICT = "execution/idempotency-conflict",
  MAX_RETRIES_EXCEEDED = "execution/max-retries-exceeded",
  INVALID_STATE_TRANSITION = "execution/invalid-state-transition",
  INVALID_CONTINUATION_LEASE_DURATION = "execution/invalid-continuation-lease-duration",
  CONTINUATION_UNSUPPORTED = "execution/continuation-unsupported",
  CONTINUATION_CONFLICT = "execution/continuation-conflict",
  CHECKPOINT_STORE_CONFORMANCE = "execution/checkpoint-store-conformance",
}

export type InvalidContinuationLeaseDurationProblemOptions = {
  receivedValue: number;
  minimumMs: number;
  maximumMs: number;
};

export interface ExecutionContinuationConflictEvidence {
  currentWorkerId?: string;
  currentLeaseExpiresAt?: string;
  currentStatus?: string;
}

/** Raised when a continuation lease cannot be represented safely by timers and stores. */
export class InvalidContinuationLeaseDurationProblem extends Problem {
  readonly code = ExecutionProblemCode.INVALID_CONTINUATION_LEASE_DURATION;
  readonly category = ProblemCategory.ValidationError;
  readonly receivedValue: number;
  readonly minimumMs: number;
  readonly maximumMs: number;

  constructor(options: InvalidContinuationLeaseDurationProblemOptions) {
    const serializedReceivedValue = Number.isFinite(options.receivedValue)
      ? options.receivedValue
      : String(options.receivedValue);
    super(
      ExecutionProblemCode.INVALID_CONTINUATION_LEASE_DURATION,
      ProblemCategory.ValidationError,
      `continuationLeaseDurationMs must be an integer between ${options.minimumMs} and ${options.maximumMs}; received ${String(options.receivedValue)}.`,
      {
        extensions: {
          receivedValue: serializedReceivedValue,
          minimumMs: options.minimumMs,
          maximumMs: options.maximumMs,
        },
      },
    );
    this.receivedValue = options.receivedValue;
    this.minimumMs = options.minimumMs;
    this.maximumMs = options.maximumMs;
  }
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
  static invalidContinuationLeaseDuration(
    options: InvalidContinuationLeaseDurationProblemOptions,
  ): InvalidContinuationLeaseDurationProblem {
    return new InvalidContinuationLeaseDurationProblem(options);
  }

  static notFound(detail: string): ExecutionProblem {
    return new ExecutionProblem(ExecutionProblemCode.NOT_FOUND, ProblemCategory.NotFound, detail);
  }

  static conflict(detail: string): ExecutionProblem {
    return new ExecutionProblem(ExecutionProblemCode.CONFLICT, ProblemCategory.Conflict, detail);
  }

  static idempotencyConflict(detail: string): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.IDEMPOTENCY_CONFLICT,
      ProblemCategory.Conflict,
      detail,
    );
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

  static checkpointStoreConformance(detail: string): ExecutionProblem {
    return new ExecutionProblem(
      ExecutionProblemCode.CHECKPOINT_STORE_CONFORMANCE,
      ProblemCategory.InternalServerError,
      detail,
    );
  }
}
