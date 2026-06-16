import type {
  AddExecutionLogParams,
  CreateExecutionParams,
  Execution,
  ExecutionError,
  ListExecutionsOptions,
  ProgressInfo,
  ReplayExecutionParams,
} from "../types";

/**
 * ExecutionManager defines the lifecycle management interface for executions.
 *
 * Handles state transitions, idempotency, timeout tracking, progress updates,
 * and checkpoint management for batch resume functionality.
 */
export interface ExecutionManager {
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
   * Retry a failed or timed-out execution.
   *
   * Increments attempts counter and transitions to 'retrying' status.
   * Subsequent start() call will transition to 'running'.
   *
   * @throws Error if execution not found or maxAttempts exhausted
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
   * Transitions status to 'timed_out' and sets completedAt.
   * Called internally when timeout threshold is exceeded.
   *
   * @throws Error if execution not found or state transition is invalid
   */
  timeout(id: string): Promise<Execution>;
}

/**
 * Optional inspection capabilities for execution managers.
 */
export interface ExecutionInspectionManager {
  /**
   * Get a single execution by ID.
   *
   * @throws Error if execution not found
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
