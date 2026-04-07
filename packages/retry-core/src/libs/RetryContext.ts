/**
 * Context object passed to retry operations and listeners.
 * Tracks retry state across attempts.
 */
export class RetryContext {
  private _attempt: number = 0;
  private _startTimeMs: number;
  private _lastError: Error | null = null;
  private _exhausted: boolean = false;
  private readonly _attributes: Map<string, unknown> = new Map();

  constructor(
    public readonly methodName: string,
    public readonly args: unknown[],
    public readonly maxAttempts: number
  ) {
    this._startTimeMs = Date.now();
  }

  get attempt(): number {
    return this._attempt;
  }

  get remainingAttempts(): number {
    return Math.max(0, this.maxAttempts - this._attempt);
  }

  get elapsedTimeMs(): number {
    return Date.now() - this._startTimeMs;
  }

  get lastError(): Error | null {
    return this._lastError;
  }

  get exhausted(): boolean {
    return this._exhausted;
  }

  incrementAttempt(): void {
    this._attempt++;
  }

  setLastError(error: Error): void {
    this._lastError = error;
  }

  setExhausted(): void {
    this._exhausted = true;
  }

  getAttribute<T>(key: string): T | undefined {
    const value = this._attributes.get(key);
    return value as T | undefined;
  }

  setAttribute(key: string, value: unknown): void {
    this._attributes.set(key, value);
  }

  reset(): void {
    this._attempt = 0;
    this._startTimeMs = Date.now();
    this._lastError = null;
    this._exhausted = false;
    this._attributes.clear();
  }
}
