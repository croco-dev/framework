/**
 * AWS Lambda context interface (minimal).
 */
export interface LambdaContext {
  getRemainingTimeInMillis(): number;
}

/**
 * Global Lambda context holder.
 * Set this at the start of your Lambda handler.
 */
let globalLambdaContext: LambdaContext | null = null;

/**
 * Set the Lambda context for timeout checking.
 * Call this at the start of your Lambda handler.
 *
 * @example
 * ```typescript
 * export const handler = async (event, context) => {
 *   setLambdaContext(context);
 *   // ... your code
 * };
 * ```
 */
export function setLambdaContext(context: LambdaContext | null): void {
  globalLambdaContext = context;
}

/**
 * Get the current Lambda context.
 */
export function getLambdaContext(): LambdaContext | null {
  return globalLambdaContext;
}

/**
 * Check if running in Lambda environment.
 */
export function isLambdaEnvironment(): boolean {
  return (
    globalLambdaContext !== null ||
    (typeof process !== 'undefined' && process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined)
  );
}

/**
 * Get remaining execution time in milliseconds.
 * Returns Infinity if not in Lambda or context not set.
 */
export function getRemainingTimeInMillis(): number {
  if (globalLambdaContext) {
    return globalLambdaContext.getRemainingTimeInMillis();
  }
  return Infinity;
}

/**
 * Options for timeout guard.
 */
export interface TimeoutGuardOptions {
  /** Minimum time to reserve for cleanup (ms). Default: 5000 */
  reserveTimeMs?: number;

  /** Custom timeout checker (for testing) */
  getRemainingTime?: () => number;
}

/**
 * Check if there's enough time for another retry attempt.
 *
 * @param nextDelayMs Expected delay before next attempt
 * @param options Guard options
 * @returns true if there's enough time, false otherwise
 */
export function hasTimeForRetry(nextDelayMs: number, options: TimeoutGuardOptions = {}): boolean {
  const reserveTimeMs = options.reserveTimeMs ?? 5000;
  const getRemainingTime = options.getRemainingTime ?? getRemainingTimeInMillis;

  const remaining = getRemainingTime();
  const required = nextDelayMs + reserveTimeMs;

  return remaining > required;
}

/**
 * Create a timeout-aware wrapper for retry operations.
 * Throws if not enough time remains.
 */
export class LambdaTimeoutGuard {
  private readonly reserveTimeMs: number;
  private readonly getRemainingTime: () => number;

  constructor(options: TimeoutGuardOptions = {}) {
    this.reserveTimeMs = options.reserveTimeMs ?? 5000;
    this.getRemainingTime = options.getRemainingTime ?? getRemainingTimeInMillis;
  }

  /**
   * Check if retry should continue.
   * @param nextDelayMs Expected delay for next attempt
   * @throws Error if not enough time
   */
  checkTimeout(nextDelayMs: number): void {
    if (
      !hasTimeForRetry(nextDelayMs, {
        reserveTimeMs: this.reserveTimeMs,
        getRemainingTime: this.getRemainingTime,
      })
    ) {
      const remaining = this.getRemainingTime();
      throw new Error(`Lambda timeout guard: ${remaining}ms remaining, need ${nextDelayMs + this.reserveTimeMs}ms`);
    }
  }

  /**
   * Get remaining time in milliseconds.
   */
  getRemainingTimeMs(): number {
    return this.getRemainingTime();
  }
}
