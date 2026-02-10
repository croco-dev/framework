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
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying' | 'timed_out';

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
}

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
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
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
  /** Optional parent execution ID */
  parentId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Checkpoints for batch resume (key-value pairs) */
  checkpoints?: Record<string, unknown>;
  /** Progress information */
  progress?: ProgressInfo;
}
