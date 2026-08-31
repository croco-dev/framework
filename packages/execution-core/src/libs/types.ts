/**
 * Execution status represents the current state of an execution.
 *
 * State transitions (allowed only):
 * - pending → running | cancelled
 * - running → completed | failed | timed_out | cancelled
 * - failed → retrying → running
 * - retrying → failed (when max retries exhausted)
 * - timed_out → retrying
 *
 * Terminal states (no outgoing transitions):
 * - completed, cancelled, failed (when max retries exhausted)
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying"
  | "timed_out";

/**
 * Log severity recorded against an execution.
 */
export type ExecutionLogLevel = "debug" | "info" | "warn" | "error";

/**
 * Append-only execution log entry for inspectable workflow/task history.
 */
export interface ExecutionLogEntry {
  /** ISO timestamp for when this log entry was recorded */
  timestamp: string;
  /** Severity level */
  level: ExecutionLogLevel;
  /** Human-readable log message */
  message: string;
  /** Optional structured log data */
  data?: Record<string, unknown>;
}

/**
 * Parameters for recording an execution log entry.
 */
export interface AddExecutionLogParams {
  /** Severity level (default: info) */
  level?: ExecutionLogLevel;
  /** Human-readable log message */
  message: string;
  /** Optional structured log data */
  data?: Record<string, unknown>;
  /** Optional timestamp override for deterministic tests or imported logs */
  timestamp?: Date | string;
}

/**
 * Parameters for replaying a failed execution.
 */
export interface ReplayExecutionParams {
  /** Optional replay reason stored in metadata and initial log entry */
  reason?: string;
  /** Optional payload override. Defaults to the original execution payload. */
  payload?: unknown;
  /** Optional metadata merged before system replay metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error details for failed executions.
 */
export interface ExecutionError {
  /** Error message */
  message: string;
  /** Optional error code for categorization */
  code?: string;
  /** Stack trace for debugging */
  stack?: string;
  /** Whether this error is retryable */
  retryable: boolean;
  /**
   * Whether the abandoned attempt may still commit side effects. The state clears when the handler
   * settles, an idempotent or fenced retry contract is confirmed, or an operator records recovery.
   */
  indeterminate?: boolean;
}

/**
 * Identifies the one execution attempt allowed to commit Croco-managed state.
 */
export type ExecutionAttemptToken = {
  /** Persisted execution identifier. */
  executionId: string;
  /** Persisted attempt number returned by start(). */
  attempt: number;
};

/**
 * Progress information for long-running executions.
 */
export interface ProgressInfo {
  /** Current progress value */
  current: number;
  /** Total target value */
  total: number;
  /** Optional progress message */
  message?: string;
  /** Calculated percentage (0-100) - auto-calculated if not provided */
  percent?: number;
}

/**
 * A lease held by one continuation worker.
 *
 * The fencing token is required for every mutation made while the lease is held.
 * The processing token is stable for one logical checkpoint, including lease takeover.
 */
export interface ExecutionContinuationClaim {
  fencingToken: string;
  processingToken: string;
  workerId: string;
  attempt: number;
  expiresAt: Date;
}

/**
 * Publication staged atomically with checkpoint changes.
 */
export interface ExecutionContinuationPublication {
  attempt: number;
  sourceToken: string;
  nextToken: string;
}

/**
 * Optional continuation state for chunked or externally delivered executions.
 */
export interface ExecutionContinuationState {
  attempt: number;
  expectedToken?: string;
  retrySourceToken?: string;
  claim?: ExecutionContinuationClaim;
  pendingPublication?: ExecutionContinuationPublication;
}

/**
 * Parameters for creating a new execution.
 */
export interface CreateExecutionParams {
  /** Execution type: 'task' | 'batch' | 'workflow' */
  type: string;
  /** Optional payload data */
  payload?: unknown;
  /** Maximum retry attempts (default: 1) */
  maxAttempts?: number;
  /** Timeout in milliseconds (default: no timeout) */
  timeout?: number;
  /** Optional scheduled start time */
  scheduledFor?: Date;
  /** Optional idempotency key for deduplication */
  idempotencyKey?: string;
  /**
   * Optional legacy keys checked only for a matching execution request.
   *
   * This supports bounded idempotency-key migrations without allowing a legacy collision
   * from another execution type to block the new key. A matching execution type with a
   * different durably persisted payload is an explicit idempotency conflict.
   *
   * Legacy and replacement writers must not run concurrently because lookup and creation
   * across two different keys cannot be made atomic by the ExecutionStore contract.
   */
  legacyIdempotencyKeys?: readonly string[];
  /** Optional original execution ID when this execution is a replay */
  replayOf?: string;
  /** Initial log entries */
  logs?: ExecutionLogEntry[];
  /** Optional parent execution ID for nested executions */
  parentId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * List options for querying executions.
 */
export interface ListExecutionsOptions {
  /** Filter by status */
  status?: ExecutionStatus;
  /** Filter by type */
  type?: string;
  /** Filter by parent ID */
  parentId?: string;
  /** Filter by original execution ID when listing replay executions */
  replayOf?: string | null;
  /**
   * Maximum number of results to return.
   *
   * Callers that require a complete result set must paginate with `limit` and `offset` because
   * store implementations may apply a documented default when this value is omitted.
   */
  limit?: number;
  /** Zero-based offset for pagination. Defaults to the first result. */
  offset?: number;
}

/**
 * Stable keyset options for scanning running executions.
 */
export interface ListRunningExecutionsOptions {
  /** Return records whose ID sorts after this cursor. */
  afterId?: string;
  /** Maximum number of records to return. */
  limit: number;
}

/**
 * Options for an explicit timed-out execution reconciliation pass.
 */
export interface ReconcileTimedOutOptions {
  /** Deadline comparison time. Defaults to the current time. */
  now?: Date;
  /** Maximum number of records fetched per stable keyset query. */
  batchSize?: number;
}

/**
 * Summary of an explicit timed-out execution reconciliation pass.
 */
export interface ReconcileTimedOutResult {
  /** Number of running records inspected. */
  scanned: number;
  /** Number of records atomically transitioned to timed_out. */
  timedOut: number;
}

/**
 * Execution entity representing a single execution record.
 */
export interface Execution {
  /** Unique execution ID */
  id: string;
  /** Execution type: 'task' | 'batch' | 'workflow' */
  type: string;
  /** Current execution status */
  status: ExecutionStatus;
  /** Optional payload data */
  payload?: unknown;
  /** Execution result (set on completion) */
  result?: unknown;
  /** Error details (set on failure) */
  error?: ExecutionError;
  /** Current attempt count */
  attempts: number;
  /** Maximum allowed attempts */
  maxAttempts: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Execution start timestamp */
  startedAt?: Date;
  /** Execution completion timestamp */
  completedAt?: Date;
  /** Optional scheduled start time */
  scheduledFor?: Date;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Optional idempotency key for deduplication */
  idempotencyKey?: string;
  /** Canonical fingerprint of the execution type and payload used for idempotency validation. */
  requestFingerprint?: string;
  /** Original execution ID when this execution was created by replay */
  replayOf?: string;
  /** Append-only inspection log */
  logs?: ExecutionLogEntry[];
  /** Optional parent execution ID */
  parentId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Checkpoints for batch resume (key-value pairs) */
  checkpoints?: Record<string, unknown>;
  /** Progress information */
  progress?: ProgressInfo;
  /** Optional atomic continuation state for chunked deliveries */
  continuation?: ExecutionContinuationState;
}

/**
 * Store input produced by ExecutionManager after request fingerprinting and legacy-key lookup.
 */
export interface CreateExecutionRecordParams extends Omit<
  CreateExecutionParams,
  "legacyIdempotencyKeys"
> {
  /** Required and persisted when idempotencyKey is present. */
  requestFingerprint?: string;
}
