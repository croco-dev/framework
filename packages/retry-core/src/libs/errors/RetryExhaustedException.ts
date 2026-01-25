/**
 * Error thrown when all retry attempts are exhausted.
 *
 * By default, the original last error is re-thrown to preserve
 * HTTP status mapping for Problem instances. Use this wrapper
 * only when explicitly configured with wrapExhausted: true.
 */
export class RetryExhaustedException extends Error {
  public readonly name = 'RetryExhaustedException';

  constructor(
    message: string,
    public readonly lastError: Error | null = null,
    public readonly attempts: number = 0,
    public readonly methodName?: string
  ) {
    super(message);

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, RetryExhaustedException.prototype);

    // Preserve original stack trace if available
    if (lastError?.stack) {
      this.stack = `${this.stack}\n\nCaused by: ${lastError.stack}`;
    }
  }

  /**
   * Create from retry context.
   */
  static fromContext(methodName: string, attempts: number, lastError: Error | null): RetryExhaustedException {
    const message = `Retry exhausted after ${attempts} attempts for method '${methodName}'`;
    return new RetryExhaustedException(message, lastError, attempts, methodName);
  }

  /**
   * Get the original error for re-throwing.
   * Returns this exception if no original error exists.
   */
  getOriginalError(): Error {
    return this.lastError ?? this;
  }
}
