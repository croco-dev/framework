import type { BackoffPolicy } from "./BackoffPolicy";
import { RetryAbortedProblem, RetryExhaustedProblem } from "./errors";
import type { RetryContext } from "./RetryContext";
import type { RetryPolicy } from "./RetryPolicy";

interface RetryHooks {
  onStart?: (context: RetryContext) => boolean | Promise<boolean>;
  onRetryError?: (error: Error, context: RetryContext) => void | Promise<void>;
  onSuccess?: (context: RetryContext) => void | Promise<void>;
  onExhausted?: (error: Error, context: RetryContext) => void | Promise<void>;
  beforeWait?: (delay: number, context: RetryContext) => boolean | Promise<boolean>;
}

/**
 * 재시도 정책과 백오프 정책을 따라 저수준 재시도 루프를 실행합니다.
 */
export async function executeRetryLoop<T>(
  callback: () => Promise<T>,
  options: {
    maxAttempts: number;
    retryPolicy: RetryPolicy;
    backoffPolicy: BackoffPolicy;
    context: RetryContext;
  },
  hooks?: RetryHooks,
): Promise<T> {
  const retryHooks = hooks ?? {};
  const { maxAttempts, retryPolicy, backoffPolicy, context } = options;

  const shouldStart = (await retryHooks.onStart?.(context)) ?? true;
  if (!shouldStart) {
    throw RetryAbortedProblem.fromContext(context.methodName);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    context.incrementAttempt();

    try {
      const result = await callback();
      await retryHooks.onSuccess?.(context);
      return result;
    } catch (error) {
      const retryError = error instanceof Error ? error : new Error(String(error));
      context.setLastError(retryError);

      await retryHooks.onRetryError?.(retryError, context);

      const hasAttemptsLeft = attempt < maxAttempts;
      const isRetryable = retryPolicy.shouldRetry(retryError, attempt, maxAttempts);

      if (!isRetryable && hasAttemptsLeft) {
        throw retryError;
      }

      if (!hasAttemptsLeft) {
        const isNonRetryableOnLastAttempt =
          !isRetryable && !retryPolicy.shouldRetry(retryError, attempt - 1, maxAttempts);
        if (isNonRetryableOnLastAttempt) {
          throw retryError;
        }

        context.setExhausted();
        await retryHooks.onExhausted?.(retryError, context);
        throw retryError;
      }

      const delay = backoffPolicy.getDelay(attempt - 1);
      const shouldWait = (await retryHooks.beforeWait?.(delay, context)) ?? true;

      if (shouldWait) {
        await backoffPolicy.wait(attempt - 1);
      }
    }
  }

  const exhaustedError =
    context.lastError ??
    RetryExhaustedProblem.fromContext(context.methodName, maxAttempts, context.lastError);
  context.setExhausted();
  await retryHooks.onExhausted?.(exhaustedError, context);
  throw exhaustedError;
}
