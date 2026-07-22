import { AsyncLocalStorage } from "node:async_hooks";

/**
 * AWS Lambda context interface (minimal).
 */
import { LambdaTimeoutProblem } from "./errors/RetryInfrastructureProblem";
import { assertValidRetryNumber } from "./numericValidation";

export interface LambdaContext {
  getRemainingTimeInMillis(): number;
}

const lambdaContextStorage = new AsyncLocalStorage<LambdaContext | null>();

function readLambdaContext(): LambdaContext | null {
  return lambdaContextStorage.getStore() ?? null;
}

/**
 * 지정한 Lambda 컨텍스트를 현재 비동기 실행 범위에 연결합니다.
 */
export async function runWithLambdaContext<T>(
  context: LambdaContext | null,
  fn: () => T | Promise<T>,
): Promise<T> {
  return await lambdaContextStorage.run(context, fn);
}

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
  lambdaContextStorage.enterWith(context);
}

/**
 * Get the current Lambda context.
 */
export function getLambdaContext(): LambdaContext | null {
  return readLambdaContext();
}

/**
 * Check if running in Lambda environment.
 */
export function isLambdaEnvironment(): boolean {
  return (
    readLambdaContext() !== null ||
    (typeof process !== "undefined" && process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined)
  );
}

/**
 * Get remaining execution time in milliseconds.
 * Returns Infinity if not in Lambda or context not set.
 */
export function getRemainingTimeInMillis(): number {
  const context = readLambdaContext();
  if (context) {
    return context.getRemainingTimeInMillis();
  }
  return Infinity;
}

/**
 * Options for timeout guard.
 */
export interface TimeoutGuardOptions {
  /** Non-negative integer milliseconds up to 2,147,483,647. Default: 5000. */
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

  assertValidRetryNumber("lambda.nextDelayMs", nextDelayMs, "non-negative-timer-integer");
  assertValidRetryNumber("lambda.reserveTimeMs", reserveTimeMs, "non-negative-timer-integer");

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
    const reserveTimeMs = options.reserveTimeMs ?? 5000;
    assertValidRetryNumber("lambda.reserveTimeMs", reserveTimeMs, "non-negative-timer-integer");
    this.reserveTimeMs = reserveTimeMs;
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
      throw new LambdaTimeoutProblem(
        `Lambda timeout guard: ${remaining}ms remaining, need ${nextDelayMs + this.reserveTimeMs}ms`,
      );
    }
  }

  /**
   * Get remaining time in milliseconds.
   */
  getRemainingTimeMs(): number {
    return this.getRemainingTime();
  }
}
