import type { RetryContext } from './RetryContext';

/**
 * Listener interface for retry lifecycle events.
 * Implement this to add logging, metrics, or custom behavior.
 */
export interface RetryListener {
  /**
   * Called before the first attempt.
   * Return false to veto the retry operation.
   */
  onStart?(context: RetryContext): boolean | Promise<boolean>;

  /**
   * Called after each failed attempt (before backoff).
   */
  onError?(context: RetryContext, error: Error): void | Promise<void>;

  /**
   * Called after a successful attempt.
   */
  onSuccess?(context: RetryContext): void | Promise<void>;

  /**
   * Called when all retry attempts are exhausted.
   */
  onExhausted?(context: RetryContext): void | Promise<void>;
}

/**
 * Composite listener that delegates to multiple listeners.
 */
export class CompositeRetryListener implements RetryListener {
  constructor(private readonly listeners: RetryListener[]) {}

  async onStart(context: RetryContext): Promise<boolean> {
    for (const listener of this.listeners) {
      if (listener.onStart) {
        const result = await listener.onStart(context);
        if (result === false) return false;
      }
    }
    return true;
  }

  async onError(context: RetryContext, error: Error): Promise<void> {
    for (const listener of this.listeners) {
      if (listener.onError) {
        await listener.onError(context, error);
      }
    }
  }

  async onSuccess(context: RetryContext): Promise<void> {
    for (const listener of this.listeners) {
      if (listener.onSuccess) {
        await listener.onSuccess(context);
      }
    }
  }

  async onExhausted(context: RetryContext): Promise<void> {
    for (const listener of this.listeners) {
      if (listener.onExhausted) {
        await listener.onExhausted(context);
      }
    }
  }
}

/**
 * Simple logging listener for debugging.
 */
export class LoggingRetryListener implements RetryListener {
  constructor(private readonly logger: Pick<Console, 'log' | 'warn' | 'error'> = console) {}

  onStart(context: RetryContext): boolean {
    this.logger.log(`[Retry] Starting ${context.methodName}, max attempts: ${context.maxAttempts}`);
    return true;
  }

  onError(context: RetryContext, error: Error): void {
    this.logger.warn(`[Retry] ${context.methodName} attempt ${context.attempt} failed: ${error.message}`);
  }

  onSuccess(context: RetryContext): void {
    this.logger.log(`[Retry] ${context.methodName} succeeded on attempt ${context.attempt}`);
  }

  onExhausted(context: RetryContext): void {
    this.logger.error(`[Retry] ${context.methodName} exhausted after ${context.attempt} attempts`);
  }
}
