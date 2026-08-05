import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  type RuntimeInspector,
  type RuntimeInspectorRecorder,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import { type BackoffOptions, type BackoffPolicy, ExponentialBackoff } from "./BackoffPolicy";
import { RetryExhaustedProblem } from "./errors/RetryExhaustedProblem";
import { assertValidRetryNumber } from "./numericValidation";
import { RetryContext } from "./RetryContext";
import { executeRetryLoop } from "./RetryEngine";
import { CompositeRetryListener, type RetryListener } from "./RetryListener";
import { DefaultRetryPolicy, type RetryPolicy, type RetryPolicyOptions } from "./RetryPolicy";

export type RetryOrchestratorOptions = RetryPolicyOptions & {
  maxAttempts?: number;
  backoff?: BackoffOptions;
  retryPolicy?: RetryPolicy;
  backoffPolicy?: BackoffPolicy;
  wrapExhausted?: boolean;
  listeners?: RetryListener[];
  signal?: AbortSignal;
};

/**
 * 재시도 정책, 백오프, 리스너, 복구 로직을 묶어 실행하는 공용 오케스트레이터입니다.
 */
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
    recovery?: (context: RetryContext) => T | Promise<T>,
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    assertValidRetryNumber("maxAttempts", maxAttempts, "positive-safe-integer");
    const retryPolicy = options.retryPolicy ?? new DefaultRetryPolicy({ ...options });
    const backoffPolicy = options.backoffPolicy ?? new ExponentialBackoff(options.backoff);
    const listener =
      options.listeners && options.listeners.length > 0
        ? new CompositeRetryListener(options.listeners)
        : null;
    const context = new RetryContext(methodName, args, maxAttempts);
    const inspector = RetryOrchestrator.resolveRuntimeInspector();

    const hooks = {
      onStart: async (ctx: RetryContext): Promise<boolean> => {
        let shouldStart = true;

        if (additionalHooks?.onStart) {
          const result = await additionalHooks.onStart(ctx);
          if (!result) {
            shouldStart = false;
          }
        }

        if (shouldStart && listener) {
          shouldStart = await listener.onStart(ctx);
        }

        RetryOrchestrator.recordInspectionEvent(inspector, {
          kind: "retry.start",
          outcome: shouldStart ? "started" : "skipped",
          name: methodName,
          details: RetryOrchestrator.describeRetryContext(ctx),
        });

        return shouldStart;
      },
      onRetryError: async (err: Error, ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onError(ctx, err);
        }

        if (additionalHooks?.onRetryError) {
          await additionalHooks.onRetryError(err, ctx);
        }

        RetryOrchestrator.recordInspectionEvent(inspector, {
          kind: "retry.error",
          outcome: "failed",
          name: methodName,
          details: {
            ...RetryOrchestrator.describeRetryContext(ctx),
            error: RetryOrchestrator.describeError(err),
          },
        });
      },
      onSuccess: async (ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onSuccess(ctx);
        }

        if (additionalHooks?.onSuccess) {
          await additionalHooks.onSuccess(ctx);
        }

        RetryOrchestrator.recordInspectionEvent(inspector, {
          kind: "retry.success",
          outcome: "succeeded",
          name: methodName,
          durationMs: ctx.elapsedTimeMs,
          details: RetryOrchestrator.describeRetryContext(ctx),
        });
      },
      onExhausted: async (err: Error, ctx: RetryContext): Promise<void> => {
        if (listener) {
          await listener.onExhausted(ctx);
        }

        if (additionalHooks?.onExhausted) {
          await additionalHooks.onExhausted(err, ctx);
        }

        RetryOrchestrator.recordInspectionEvent(inspector, {
          kind: "retry.exhausted",
          outcome: "failed",
          name: methodName,
          durationMs: ctx.elapsedTimeMs,
          details: {
            ...RetryOrchestrator.describeRetryContext(ctx),
            error: RetryOrchestrator.describeError(err),
          },
        });
      },
      beforeWait: async (delay: number, ctx: RetryContext): Promise<boolean> => {
        const shouldWait = (await additionalHooks?.beforeWait?.(delay, ctx)) ?? true;
        RetryOrchestrator.recordInspectionEvent(inspector, {
          kind: "retry.wait",
          outcome: shouldWait ? "started" : "skipped",
          name: methodName,
          details: {
            ...RetryOrchestrator.describeRetryContext(ctx),
            delayMs: delay,
          },
        });
        return shouldWait;
      },
    };

    try {
      return await executeRetryLoop(
        callback,
        {
          maxAttempts,
          retryPolicy,
          backoffPolicy,
          context,
          signal: options.signal,
        },
        hooks,
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
          context.lastError,
        );
      }

      throw context.lastError ?? retryError;
    }
  }

  private static resolveRuntimeInspector(): RuntimeInspectorRecorder | undefined {
    return (
      Context.get()?.runtimeInspector ??
      Container.getOptional<RuntimeInspector>(DEV_INSPECTOR_TOKEN)
    );
  }

  private static recordInspectionEvent(
    inspector: RuntimeInspectorRecorder | undefined,
    input: Parameters<typeof recordRuntimeInspectionEvent>[1],
  ): void {
    recordRuntimeInspectionEvent(inspector, input);
  }

  private static describeRetryContext(context: RetryContext): Record<string, unknown> {
    return {
      methodName: context.methodName,
      attempt: context.attempt,
      maxAttempts: context.maxAttempts,
      remainingAttempts: context.remainingAttempts,
      exhausted: context.exhausted,
      argumentCount: context.args.length,
    };
  }

  private static describeError(error: Error): Record<string, unknown> {
    return {
      name: error.name,
      message: error.message,
    };
  }
}
