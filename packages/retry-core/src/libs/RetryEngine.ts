import type { BackoffPolicy } from "./BackoffPolicy";
import {
  RetryAbortedProblem,
  RetryCancellationUnsupportedProblem,
  RetryExhaustedProblem,
  RetrySuccessHookProblem,
} from "./errors";
import type { RetryContext } from "./RetryContext";
import type { RetryPolicy } from "./RetryPolicy";

export interface RetryHooks {
  onStart?: (context: RetryContext) => boolean | Promise<boolean>;
  onRetryError?: (error: Error, context: RetryContext) => void | Promise<void>;
  onSuccess?: (context: RetryContext) => void | Promise<void>;
  onExhausted?: (error: Error, context: RetryContext) => void | Promise<void>;
  beforeWait?: (delay: number, context: RetryContext) => boolean | Promise<boolean>;
}

function createSignalAbortProblem(context: RetryContext): RetryAbortedProblem {
  return RetryAbortedProblem.fromSignal(context.methodName);
}

function throwIfAborted(signal: AbortSignal | undefined, context: RetryContext): void {
  if (signal?.aborted) {
    throw createSignalAbortProblem(context);
  }
}

async function waitForBackoff(
  backoffPolicy: BackoffPolicy,
  attempt: number,
  signal: AbortSignal | undefined,
  context: RetryContext,
): Promise<void> {
  if (!signal) {
    await backoffPolicy.wait(attempt);
    return;
  }

  throwIfAborted(signal, context);

  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortListener = () => reject(createSignalAbortProblem(context));
    signal.addEventListener("abort", abortListener, { once: true });
    if (signal.aborted) {
      abortListener();
    }
  });

  try {
    await Promise.race([backoffPolicy.wait(attempt, signal), abortPromise]);
    throwIfAborted(signal, context);
  } finally {
    if (abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  }
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
    signal?: AbortSignal;
  },
  hooks?: RetryHooks,
): Promise<T> {
  const retryHooks = hooks ?? {};
  const { maxAttempts, retryPolicy, backoffPolicy, context, signal } = options;

  throwIfAborted(signal, context);
  if (signal && backoffPolicy.supportsAbortSignal !== true) {
    throw new RetryCancellationUnsupportedProblem(context.methodName);
  }

  const shouldStart = (await retryHooks.onStart?.(context)) ?? true;
  if (!shouldStart) {
    throw RetryAbortedProblem.fromContext(context.methodName);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(signal, context);
    context.incrementAttempt();

    let result: T;
    try {
      result = await callback();
    } catch (error) {
      if (error instanceof RetrySuccessHookProblem) {
        throw error;
      }

      throwIfAborted(signal, context);

      const retryError = error instanceof Error ? error : new Error(String(error));
      context.setLastError(retryError);

      await retryHooks.onRetryError?.(retryError, context);

      const hasAttemptsLeft = attempt < maxAttempts;
      const isRetryable = retryPolicy.shouldRetry(retryError, attempt, maxAttempts);

      if (!hasAttemptsLeft) {
        const wasRetryablePreviously = retryPolicy.shouldRetry(
          retryError,
          attempt - 1,
          maxAttempts,
        );

        if (!isRetryable && !wasRetryablePreviously) {
          throw retryError;
        }

        context.setExhausted();
        await retryHooks.onExhausted?.(retryError, context);
        const exhaustedError = RetryExhaustedProblem.fromContext(
          context.methodName,
          attempt,
          retryError,
        );
        exhaustedError.message = `${exhaustedError.message}: ${retryError.message}`;
        throw exhaustedError;
      }

      if (!isRetryable) {
        throw retryError;
      }

      const retryAttempt = attempt - 1;
      const delay = backoffPolicy.getDelay(retryAttempt);
      const shouldWait = (await retryHooks.beforeWait?.(delay, context)) ?? true;

      if (shouldWait) {
        await waitForBackoff(backoffPolicy, retryAttempt, signal, context);
      }

      continue;
    }

    try {
      await retryHooks.onSuccess?.(context);
    } catch (error) {
      throw new RetrySuccessHookProblem(context.methodName, attempt, error);
    }

    return result;
  }

  const exhaustedError =
    context.lastError ??
    RetryExhaustedProblem.fromContext(context.methodName, maxAttempts, context.lastError);
  context.setExhausted();
  await retryHooks.onExhausted?.(exhaustedError, context);
  throw exhaustedError;
}
