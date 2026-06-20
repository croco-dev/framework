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
