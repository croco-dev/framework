import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import { recordError } from "@croco/telemetry-api";

type AuditErrorHandlerConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onExhausted?: (error: Error, attempt: number) => void;
};

const DEFAULT_CONFIG: AuditErrorHandlerConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * 2 ** (attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AuditErrorHandler {
  private config: AuditErrorHandlerConfig;

  constructor(config: Partial<AuditErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async executeWithRetry<T>(operation: () => Promise<T>, context: string): Promise<T | undefined> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          const delay = calculateBackoff(attempt, this.config.baseDelayMs, this.config.maxDelayMs);
          await sleep(delay);
        }
      }
    }

    if (lastError) {
      this.handleExhausted(lastError, context, this.config.maxRetries);
    }
    return undefined;
  }

  private handleExhausted(error: Error, context: string, attempts: number): void {
    recordError(error);

    try {
      const logger = Container.get(LOGGER_TOKEN);
      logger.error("[AuditErrorHandler] Audit operation failed after retries", {
        context,
        attempts,
        error: error.message,
      });
    } catch (loggerError) {
      console.error(
        "[AuditErrorHandler] Failed to log audit failure (logger unavailable):",
        loggerError,
      );
    }

    if (this.config.onExhausted) {
      try {
        this.config.onExhausted(error, attempts);
      } catch (callbackError) {
        console.error("[AuditErrorHandler] onExhausted callback failed:", callbackError);
      }
    }
  }
}

export type FireAndForgetResult<T> = {
  promise: Promise<T | undefined>;
  abort: () => void;
};

export function fireAndForgetWithRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<AuditErrorHandlerConfig>,
): FireAndForgetResult<T> {
  const handler = new AuditErrorHandler(config);
  let aborted = false;

  const promise = (async (): Promise<T | undefined> => {
    if (aborted) {
      return undefined;
    }
    return handler.executeWithRetry(operation, "audit-log-write");
  })();

  const abort = (): void => {
    aborted = true;
  };

  return { promise, abort };
}
