import type {
  AddExecutionLogParams,
  CreateExecutionParams,
  Execution,
  ExecutionAttemptToken,
  ExecutionContinuationClaim,
  ExecutionContinuationPublication,
  ExecutionError,
  ListExecutionsOptions,
  ProgressInfo,
  ReconcileTimedOutOptions,
  ReconcileTimedOutResult,
  ReplayExecutionParams,
} from "../types";

export type TimeoutExecutionAttemptOptions = {
  /** Whether the abandoned attempt is safe to retry automatically. */
  retryable: boolean;
};

/**
 * Optional manager capability for attempt-fenced task mutations.
 */
export interface ExecutionAttemptManager {
  /** Whether the configured persistence store can enforce atomic attempt fencing. */
  supportsAttemptFencing(): boolean;
  completeAttempt(token: ExecutionAttemptToken, result?: unknown): Promise<Execution>;
  failAttempt(token: ExecutionAttemptToken, error: ExecutionError): Promise<Execution>;
  timeoutAttempt(
    token: ExecutionAttemptToken,
    options: TimeoutExecutionAttemptOptions,
  ): Promise<Execution>;
  updateProgressAttempt(token: ExecutionAttemptToken, progress: ProgressInfo): Promise<Execution>;
  checkpointAttempt(token: ExecutionAttemptToken, key: string, value: unknown): Promise<Execution>;
  recordLogAttempt(token: ExecutionAttemptToken, params: AddExecutionLogParams): Promise<Execution>;
  settleTimedOutAttempt(token: ExecutionAttemptToken): Promise<Execution>;
  resolveIndeterminateTimeout(token: ExecutionAttemptToken, reason: string): Promise<Execution>;
}

export interface ClaimExecutionContinuationInput {
  deliveryToken: string;
  workerId: string;
}

export type ClaimExecutionContinuationResult =
  | {
      kind: "process";
      execution: Execution;
      claim: ExecutionContinuationClaim;
    }
  | {
      kind: "publish_pending";
      execution: Execution;
      claim: ExecutionContinuationClaim;
      publication: ExecutionContinuationPublication;
    }
  | {
      kind: "stale";
      execution: Execution;
      deliveryToken: string;
      expectedToken?: string;
    }
  | {
      kind: "contended";
      execution: Execution;
      deliveryToken: string;
      claim: ExecutionContinuationClaim;
    };

export interface RenewExecutionContinuationInput {
  workerId: string;
}

export interface StageExecutionContinuationInput {
  checkpoints: Record<string, unknown>;
  nextToken: string;
}

/**
 * ExecutionManager defines the lifecycle management interface for executions.
 *
 * Handles state transitions, idempotency, timeout tracking, progress updates,
 * and checkpoint management for batch resume functionality.
 */
export interface ExecutionManager {
  /**
   * Get a single execution by ID.
   *
   * @throws Error if execution not found
   */
  get(id: string): Promise<Execution>;

  /**
   * Create a new execution.
   *
   * If idempotencyKey is provided and an existing execution with the same key exists,
   * returns the existing execution instead of creating a new one.
   *
   * The execution is created in 'pending' status.
   *
   * @returns Created or existing execution
   */
  create(params: CreateExecutionParams): Promise<Execution>;

  /**
   * Start an execution (transition to 'running').
   *
   * Sets startedAt timestamp and increments attempts counter.
   *
   * @throws Error if execution not found or state transition is invalid
   */
  start(id: string): Promise<Execution>;

  /**
   * Complete an execution (transition to 'completed').
   *
   * Sets the result, completedAt timestamp, and status to 'completed'.
   *
   * @param result Optional result data
   * @throws Error if execution not found or state transition is invalid
   */
  complete(id: string, result?: unknown): Promise<Execution>;

  /**
   * Fail an execution (transition to 'failed').
   *
   * Sets the error details and completedAt timestamp.
   * If maxAttempts not exhausted, automatically transitions to 'retrying'.
   *
   * @param error Error details
   * @throws Error if execution not found or state transition is invalid
   */
  fail(id: string, error: ExecutionError): Promise<Execution>;

  /**
   * Cancel an execution (transition to 'cancelled').
   *
   * Sets completedAt timestamp and status to 'cancelled'.
   *
   * @param reason Optional cancellation reason (stored in metadata)
   * @throws Error if execution not found or state transition is invalid
   */
  cancel(id: string, reason?: string): Promise<Execution>;

  /**
   * Retry a failed or safely resolved timed-out execution.
   *
   * Preserves the consumed attempt count and transitions to 'retrying' status.
   * The subsequent start() call transitions to 'running' and increments attempts exactly once.
   *
   * @throws Error if execution not found, maxAttempts exhausted, or timeout outcome remains indeterminate
   */
  retry(id: string): Promise<Execution>;

  /**
   * Update progress information for an execution.
   *
   * Automatically calculates percent if not provided.
   *
   * @param progress Progress information
   * @throws Error if execution not found
   */
  updateProgress(id: string, progress: ProgressInfo): Promise<Execution>;

  /**
   * Set a checkpoint for batch resume functionality.
   *
   * Stores key-value pairs in the checkpoints map for later resume.
   *
   * @param key Checkpoint key
   * @param value Checkpoint value
   * @throws Error if execution not found
   */
  checkpoint(id: string, key: string, value: unknown): Promise<Execution>;

  /**
   * Mark an execution as timed out.
   *
   * Transitions status to an indeterminate 'timed_out' outcome and sets completedAt.
   * Called internally when timeout threshold is exceeded.
   *
   * @throws Error if execution not found or state transition is invalid
   */
  timeout(id: string): Promise<Execution>;

  /**
   * Reconcile persisted running executions whose configured deadline has elapsed.
   */
  reconcileTimedOut(options?: ReconcileTimedOutOptions): Promise<ReconcileTimedOutResult>;
}

/**
 * Optional inspection capabilities for execution managers.
 */
export interface ExecutionInspectionManager {
  /**
   * Get a single execution by ID.
   *
   * This remains available here for compatibility and is also part of the primary manager contract.
   */
  get(id: string): Promise<Execution>;

  /**
   * List executions for inspection and operations views.
   */
  list(options?: ListExecutionsOptions): Promise<Execution[]>;

  /**
   * Append a structured log entry to an execution.
   *
   * @throws Error if execution not found
   */
  recordLog(id: string, params: AddExecutionLogParams): Promise<Execution>;
}

/**
 * Optional replay capabilities for execution managers.
 */
export interface ExecutionReplayManager {
  /**
   * Create a new pending execution linked to a failed or timed-out source execution.
   *
   * Replay intentionally does not copy idempotencyKey, so operators can replay a failed
   * execution without returning the original record through deduplication.
   *
   * @throws Error if execution not found or source execution is not replayable
   */
  replay(id: string, params?: ReplayExecutionParams): Promise<Execution>;
}

/**
 * Optional atomic continuation capabilities for execution managers.
 */
export interface ExecutionContinuationManager {
  /**
   * Return the lease duration used for continuation claims.
   *
   * Continuation runtimes use this value to validate that their heartbeat
   * cadence renews ownership before the lease can expire.
   */
  getContinuationLeaseDurationMs(): number;

  claimContinuation(
    id: string,
    input: ClaimExecutionContinuationInput,
  ): Promise<ClaimExecutionContinuationResult>;

  renewContinuationClaim(
    id: string,
    claim: ExecutionContinuationClaim,
    input: RenewExecutionContinuationInput,
  ): Promise<Execution>;

  stageContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    input: StageExecutionContinuationInput,
  ): Promise<Execution>;

  confirmContinuationPublication(id: string, claim: ExecutionContinuationClaim): Promise<Execution>;

  completeContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    result?: unknown,
  ): Promise<Execution>;

  failContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    error: ExecutionError,
  ): Promise<Execution>;
}
