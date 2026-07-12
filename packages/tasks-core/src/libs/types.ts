/**
 * Task options for configuring task behavior.
 */
export type TaskOptions = {
  /**
   * Optional task name. If not provided, defaults to 'ClassName.methodName'.
   */
  name?: string;
  /**
   * Maximum retry attempts (default: 1).
   */
  maxAttempts?: number;
  /**
   * Timeout in milliseconds (default: no timeout).
   */
  timeout?: number;
  /**
   * Optional idempotency key for deduplication.
   */
  idempotencyKey?: string;
};

/**
 * Task reference for identifying tasks.
 */
export type TaskReference = {
  /** Task name */
  name: string;
  /** Target class constructor */
  target: object;
  /** Method name */
  methodName: string;
};

/**
 * Runtime options for a single task execution.
 */
export type TaskExecutionOptions = {
  /**
   * Optional parent execution ID when this task is part of a workflow or batch.
   */
  parentId?: string;
  /**
   * Optional execution-level idempotency key for deduplicating this task run.
   */
  idempotencyKey?: string;
  /**
   * Optional execution metadata for inspection and operations views.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Runtime context provided as the optional second argument to task handlers.
 */
export type TaskExecutionContext = {
  /** Persisted execution identifier used for inspection and retry. */
  executionId: string;
  /** Persisted attempt number returned by ExecutionManager.start(). */
  attempt: number;
  /** Cooperative cancellation signal aborted when the execution deadline expires. */
  signal: AbortSignal;
};

/**
 * Task metadata stored by the decorator.
 */
export type TaskMetadata = {
  /** Task name */
  name: string;
  /** Options provided to decorator */
  options?: TaskOptions;
  /** Target class */
  target: object;
  /** Method name (string or symbol) */
  methodName: string | symbol;
};
