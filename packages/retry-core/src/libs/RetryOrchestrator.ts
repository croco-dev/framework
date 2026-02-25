import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from './BackoffPolicy';
import { RetryExhaustedProblem } from './errors/RetryExhaustedProblem';
import { RetryContext } from './RetryContext';
import { executeRetryLoop } from './RetryEngine';
import { CompositeRetryListener, type RetryListener } from './RetryListener';
import { DefaultRetryPolicy, type RetryPolicy, type RetryPolicyOptions } from './RetryPolicy';

export type RetryOrchestratorOptions = RetryPolicyOptions & {
  maxAttempts?: number;
  backoff?: BackoffOptions;
  retryPolicy?: RetryPolicy;
  backoffPolicy?: BackoffPolicy;
  wrapExhausted?: boolean;
  listeners?: RetryListener[];
};

export class RetryOrchestrator {
  static async execute<T>(
    methodName: string,
    args: unknown[],
    callback: () => Promise<T>,
    options: RetryOrchestratorOptions,
    additionalHooks?: {
      onStart?: (ctx: RetryContext) => boolean | Promise<boolean>;
      onRetryError?: (err: Error, ctx: RetryContext) => void | Promise<void>;
      onSuccess?: (ctx: RetryContext) => void | Promise<void>;
      onExhausted?: (err: Error, ctx: RetryContext) => void | Promise<void>;
      beforeWait?: (delay: number, ctx: RetryContext) => boolean | Promise<boolean>;
    },
    recovery?: (context: RetryContext) => T | Promise<T>
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    const retryPolicy = options.retryPolicy ?? new DefaultRetryPolicy({ ...options });
    const backoffPolicy = options.backoffPolicy ?? new ExponentialBackoff(options.backoff);
    const listener =
      options.listeners && options.listeners.length > 0 ? new CompositeRetryListener(options.listeners) : null;
    const context = new RetryContext(methodName, args, maxAttempts);

    const hooks = {
      onStart: async (ctx: RetryContext): Promise<boolean> => {
        if (additionalHooks?.onStart) {
          const result = await additionalHooks.onStart(ctx);
          if (!result) {
            return false;
          }
        }

        if (listener) {
          return await listener.onStart(ctx);
        }

        return true;
      },
      onRetryError: async (err: Error, ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onError(ctx, err);
        }

        if (additionalHooks?.onRetryError) {
          await additionalHooks.onRetryError(err, ctx);
        }
      },
      onSuccess: async (ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onSuccess(ctx);
        }

        if (additionalHooks?.onSuccess) {
          await additionalHooks.onSuccess(ctx);
        }
      },
      onExhausted: async (err: Error, ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onExhausted(ctx);
        }

        if (additionalHooks?.onExhausted) {
          await additionalHooks.onExhausted(err, ctx);
        }
      },
      beforeWait: additionalHooks?.beforeWait,
    };

    try {
      return await executeRetryLoop(
        callback,
        {
          maxAttempts,
          retryPolicy,
          backoffPolicy,
          context,
        },
        hooks
      );
    } catch (error) {
      const retryError = error instanceof Error ? error : new Error(String(error));

      if (!context.exhausted) {
        throw retryError;
      }

      if (recovery) {
        return await recovery(context);
      }

      if (options.wrapExhausted) {
        throw new RetryExhaustedProblem(
          `Retry exhausted: ${methodName} failed after ${maxAttempts} attempts`,
          context.lastError
        );
      }

      throw context.lastError ?? retryError;
    }
  }
}
