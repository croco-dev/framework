/**
 * Configuration for backoff behavior.
 */
export interface BackoffOptions {
  /** Initial delay in milliseconds (default: 1000) */
  delay?: number;

  /** Multiplier for exponential backoff (default: 2) */
  multiplier?: number;

  /** Maximum delay cap in milliseconds (default: 30000) */
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
  /** Calculate delay for the given attempt (0-based) */
  getDelay(attempt: number): number;

  /** Wait for the calculated delay */
  wait(attempt: number): Promise<void>;

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
  sleep?: (ms: number) => Promise<void>;

  /** Random function (default: Math.random) */
  random?: () => number;
}

const DEFAULT_DELAY = 1000;
const DEFAULT_MULTIPLIER = 2;
const DEFAULT_MAX_DELAY = 30000;

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
  private readonly delay: number;
  private readonly multiplier: number;
  private readonly maxDelay: number;
  private readonly jitter: boolean;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly computedDelays = new Map<number, number>();

  constructor(options: BackoffOptions = {}, deps: BackoffDependencies = {}) {
    this.delay = options.delay ?? DEFAULT_DELAY;
    this.multiplier = options.multiplier ?? DEFAULT_MULTIPLIER;
    this.maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
    this.jitter = options.jitter ?? true;

    // Dependency injection for testing
    this.sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
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
  async wait(attempt: number): Promise<void> {
    const delayMs = this.computedDelays.get(attempt) ?? this.getDelay(attempt);
    if (delayMs > 0) {
      await this.sleep(delayMs);
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
  private readonly delayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly computedDelays = new Map<number, number>();

  constructor(delayMs: number = DEFAULT_DELAY, deps: BackoffDependencies = {}) {
    this.delayMs = delayMs;
    this.sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  getDelay(attempt: number): number {
    this.computedDelays.set(attempt, this.delayMs);
    return this.delayMs;
  }

  async wait(attempt: number): Promise<void> {
    const delayMs = this.computedDelays.get(attempt) ?? this.delayMs;
    if (delayMs > 0) {
      await this.sleep(delayMs);
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
  getDelay(_attempt: number): number {
    return 0;
  }

  async wait(_attempt: number): Promise<void> {
    // No delay
  }

  reset(): void {
    // Nothing to reset
  }
}
