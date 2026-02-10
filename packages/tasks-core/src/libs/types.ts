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
 * Task metadata stored by the decorator.
 */
export type TaskMetadata = {
  /** Task name */
  name: string;
  /** Options provided to decorator */
  options?: TaskOptions;
  /** Target class */
  target: object;
  /** Method name */
  methodName: string;
};
