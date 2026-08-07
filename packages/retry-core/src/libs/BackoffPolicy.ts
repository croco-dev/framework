import { assertValidRetryNumber } from "./numericValidation";

/**
 * Configuration for backoff behavior.
 */
export interface BackoffOptions {
  /** Non-negative integer milliseconds up to 2,147,483,647 (default: 1000). */
  delay?: number;

  /** Positive finite multiplier (default: 2). */
  multiplier?: number;

  /** Positive integer milliseconds up to 2,147,483,647 (default: 30000). */
  maxDelay?: number;

  /** Enable Full Jitter randomization (default: true) */
  jitter?: boolean;
}

/**
 * Backoff policy interface.
 *
 * @typeParam T - Backoff 구현체의 추가 옵션 타입
 */
export interface BackoffPolicy<T = unknown> {
  /** Whether this policy guarantees that wait stops when its signal aborts. */
  readonly supportsAbortSignal?: boolean;

  /** Calculate delay for the given attempt (0-based) */
  getDelay(attempt: number): number;

  /** Wait for the calculated delay, cancelling promptly when the signal aborts. */
  wait(attempt: number, signal?: AbortSignal): Promise<void>;

  /** Reset internal state if any */
  reset(): void;

  /** Backoff 구현체의 추가 옵션 (구현체에 따라 다름) */
  readonly options?: T;
}

/**
 * Dependency injection for testability.
 */
export interface BackoffDependencies {
  /** Sleep function (default: setTimeout-based) */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;

  /** Whether an injected sleep function guarantees cancellation when its signal aborts. */
  sleepSupportsAbortSignal?: boolean;

  /** Random function (default: Math.random) */
  random?: () => number;
}

const DEFAULT_DELAY = 1000;
const DEFAULT_MULTIPLIER = 2;
const DEFAULT_MAX_DELAY = 30000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }
  });
}

/**
 * Exponential backoff with Full Jitter.
 *
 * Implements AWS-recommended pattern to prevent Thundering Herd:
 * cap = min(maxDelay, delay * multiplier^attempt)
 * sleep = random(0, cap)
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export class ExponentialBackoff implements BackoffPolicy {
  readonly supportsAbortSignal: boolean;
  private readonly delay: number;
  private readonly multiplier: number;
  private readonly maxDelay: number;
  private readonly jitter: boolean;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly computedDelays = new Map<number, number>();

  constructor(options: BackoffOptions = {}, deps: BackoffDependencies = {}) {
    const delay = options.delay ?? DEFAULT_DELAY;
    const multiplier = options.multiplier ?? DEFAULT_MULTIPLIER;
    const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;

    assertValidRetryNumber("backoff.delay", delay, "non-negative-timer-integer");
    assertValidRetryNumber("backoff.multiplier", multiplier, "finite-positive-number");
    assertValidRetryNumber("backoff.maxDelay", maxDelay, "positive-timer-integer");

    this.delay = delay;
    this.multiplier = multiplier;
    this.maxDelay = maxDelay;
    this.jitter = options.jitter ?? true;

    // Dependency injection for testing
    this.sleep = deps.sleep ?? sleep;
    this.supportsAbortSignal = deps.sleep === undefined || deps.sleepSupportsAbortSignal === true;
    this.random = deps.random ?? Math.random;
  }

  /**
   * Calculate delay for attempt (0-based index).
   *
   * Without jitter: min(maxDelay, delay * multiplier^attempt)
   * With jitter: random(0, cap) - Full Jitter
   */
  getDelay(attempt: number): number {
    const exponentialDelay = this.delay * this.multiplier ** attempt;
    const cappedDelay = Math.min(this.maxDelay, exponentialDelay);
    const delayMs = this.jitter ? Math.floor(this.random() * cappedDelay) : cappedDelay;

    this.computedDelays.set(attempt, delayMs);
    return delayMs;
  }

  /**
   * Wait for the calculated delay.
   */
  async wait(attempt: number, signal?: AbortSignal): Promise<void> {
    const delayMs = this.computedDelays.get(attempt) ?? this.getDelay(attempt);
    if (delayMs > 0) {
      if (signal) {
        await this.sleep(delayMs, signal);
      } else {
        await this.sleep(delayMs);
      }
    }
  }

  /**
   * Reset (no-op for stateless implementation).
   */
  reset(): void {
    this.computedDelays.clear();
  }
}

/**
 * Fixed delay backoff (no exponential growth).
 */
export class FixedBackoff implements BackoffPolicy {
  readonly supportsAbortSignal: boolean;
  private readonly delayMs: number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly computedDelays = new Map<number, number>();

  constructor(delayMs: number = DEFAULT_DELAY, deps: BackoffDependencies = {}) {
    assertValidRetryNumber("fixedBackoff.delay", delayMs, "non-negative-timer-integer");
    this.delayMs = delayMs;
    this.sleep = deps.sleep ?? sleep;
    this.supportsAbortSignal = deps.sleep === undefined || deps.sleepSupportsAbortSignal === true;
  }

  getDelay(attempt: number): number {
    this.computedDelays.set(attempt, this.delayMs);
    return this.delayMs;
  }

  async wait(attempt: number, signal?: AbortSignal): Promise<void> {
    const delayMs = this.computedDelays.get(attempt) ?? this.delayMs;
    if (delayMs > 0) {
      if (signal) {
        await this.sleep(delayMs, signal);
      } else {
        await this.sleep(delayMs);
      }
    }
  }

  reset(): void {
    this.computedDelays.clear();
  }
}

/**
 * No delay backoff (for testing or immediate retry scenarios).
 */
export class NoBackoff implements BackoffPolicy {
  readonly supportsAbortSignal = true;
  getDelay(_attempt: number): number {
    return 0;
  }

  async wait(_attempt: number, _signal?: AbortSignal): Promise<void> {
    // No delay
  }

  reset(): void {
    // Nothing to reset
  }
}
