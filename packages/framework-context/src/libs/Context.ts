import { AsyncLocalStorage } from "node:async_hooks";
import { ProblemFactory } from "@croco/problems-core";
import { MiddlewareChain } from "./MiddlewareChain";
import type {
  LifecycleHooks,
  Middleware,
  RequestContext,
  RuntimeContext,
  RuntimePlatform,
} from "./types";

interface ContextData {
  context: RequestContext;
  createdAt: number;
  scopedCache: Map<unknown, unknown>;
  scopedDisposables: Map<object, () => void>;
}

export type ContextRunOptions = {
  readonly inheritScope?: boolean;
};

const contextStorage = new AsyncLocalStorage<ContextData>();

export function trackRequestInstance(instance: object, dispose: () => void): void {
  const data = contextStorage.getStore();
  if (!data) {
    throw ProblemFactory.internalServerError(
      "framework-context/request-scope-missing",
      "A request instance cannot be tracked outside a request context.",
    );
  }
  if (!data.scopedDisposables.has(instance)) {
    data.scopedDisposables.set(instance, dispose);
  }
}

/**
 * AsyncLocalStorage 기반으로 요청 컨텍스트를 실행하고 조회하는 유틸리티입니다.
 */
export class Context {
  private static readonly STORAGE = contextStorage;

  /**
   * Runs a callback with the provided request context.
   * Nested runs create a fresh request scope unless `inheritScope` is enabled.
   */
  static run<T>(
    context: RequestContext,
    fn: () => Promise<T> | T,
    options: ContextRunOptions = {},
  ): Promise<T> | T {
    const parentData = options.inheritScope ? Context.STORAGE.getStore() : undefined;
    const data: ContextData = {
      context,
      createdAt: parentData?.createdAt ?? Date.now(),
      scopedCache: parentData?.scopedCache ?? new Map(),
      scopedDisposables: parentData?.scopedDisposables ?? new Map(),
    };
    const ownsScope = parentData === undefined;
    return Context.STORAGE.run(data, () => {
      let result: Promise<T> | T;
      try {
        result = fn();
      } catch (error) {
        if (ownsScope) Context.disposeRequestScope(data, { error });
        throw error;
      }
      if (
        result !== null &&
        result !== undefined &&
        typeof (result as Promise<T>).then === "function"
      ) {
        return Promise.resolve(result).then(
          (value) => {
            if (ownsScope) Context.disposeRequestScope(data);
            return value;
          },
          (error: unknown) => {
            if (ownsScope) Context.disposeRequestScope(data, { error });
            throw error;
          },
        );
      }
      if (ownsScope) Context.disposeRequestScope(data);
      return result;
    });
  }

  private static disposeRequestScope(
    data: ContextData,
    failure?: { readonly error: unknown },
  ): void {
    const failures: unknown[] = [];
    for (const dispose of [...data.scopedDisposables.values()].reverse()) {
      try {
        dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    data.scopedDisposables.clear();
    data.scopedCache.clear();
    if (failures.length === 0) return;

    const cleanupFailure = ProblemFactory.internalServerError(
      "framework-context/request-scope-disposal-failed",
      "Request-scoped provider cleanup failed.",
      { extensions: { cleanupFailures: failures } },
    );
    if (!failure) throw cleanupFailure;
    Context.reportRequestCleanupFailure(data.context, failure.error, cleanupFailure);
  }

  private static reportRequestCleanupFailure(
    context: RequestContext,
    primaryError: unknown,
    cleanupFailure: unknown,
  ): void {
    const details = { primaryError, cleanupFailure };
    const reportingFailures: unknown[] = [];
    try {
      if (context.runtimeInspector) {
        context.runtimeInspector.recordEvent({
          requestId: context.requestId,
          kind: "error",
          outcome: "failed",
          name: "request.cleanup",
          details,
        });
        return;
      }
    } catch (error) {
      reportingFailures.push(error);
    }
    try {
      if (context.runtime?.logger) {
        context.runtime.logger.error("Request provider cleanup failed", {
          ...details,
          reportingFailures,
        });
        return;
      }
    } catch (error) {
      reportingFailures.push(error);
    }
    console.error("[Context] Request provider cleanup failed", { ...details, reportingFailures });
  }

  static get(): RequestContext | null {
    const data = Context.STORAGE.getStore();
    return data?.context ?? null;
  }

  static getRequestId(): string | null {
    const context = Context.get();
    return context?.requestId ?? null;
  }

  static getCurrentUser(): RequestContext["user"] | null {
    const context = Context.get();
    return context?.user ?? null;
  }

  static getTenantId(): string | null {
    const context = Context.get();
    return context?.tenantId ?? null;
  }

  static isActive(): boolean {
    return Context.STORAGE.getStore() !== undefined;
  }

  static getCreatedAt(): number | null {
    const data = Context.STORAGE.getStore();
    return data?.createdAt ?? null;
  }

  static getCache(): Map<unknown, unknown> | undefined {
    return Context.STORAGE.getStore()?.scopedCache;
  }

  /**
   * Get active trace ID from request context propagation
   */
  static getActiveTraceId(): string | null {
    const context = Context.get();
    return context?.traceId ?? context?.runtime?.trace?.traceId ?? null;
  }

  static getRuntimeContext(): RuntimeContext | null {
    const context = Context.get();
    return context?.runtime ?? null;
  }

  static getRuntimePlatform(): RuntimePlatform | null {
    return Context.getRuntimeContext()?.platform ?? null;
  }

  /**
   * Run a function with middleware chain and lifecycle hooks
   * Execution order: onRequestStart -> middleware chain -> fn -> onRequestEnd
   * If error occurs: onRequestError is called instead of onRequestEnd
   */
  static async runWithMiddleware<T>(
    context: RequestContext,
    middlewares: Middleware[],
    hooks: LifecycleHooks<RequestContext>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return Context.run(context, async () => {
      try {
        await hooks.onRequestStart?.(context);

        const chain = new MiddlewareChain<RequestContext>();
        for (const middleware of middlewares) {
          chain.use(middleware);
        }

        const result = middlewares.length > 0 ? await chain.execute(context, fn) : await fn();

        await hooks.onRequestEnd?.(context, result);

        return result;
      } catch (error) {
        const normalizedError = Context.normalizeRequestError(error);

        await Context.runRequestErrorHook(context, hooks, normalizedError);
        throw error;
      }
    });
  }

  private static normalizeRequestError(error: unknown): Error {
    try {
      if (error instanceof Error) {
        return error;
      }

      return new Error(String(error));
    } catch {
      return new Error("Non-Error request failure");
    }
  }

  private static async runRequestErrorHook(
    context: RequestContext,
    hooks: LifecycleHooks<RequestContext>,
    primaryError: Error,
  ): Promise<void> {
    try {
      await hooks.onRequestError?.(context, primaryError);
    } catch (hookError) {
      Context.reportRequestErrorHookFailure(context, primaryError, hookError);
    }
  }

  private static reportRequestErrorHookFailure(
    context: RequestContext,
    primaryError: Error,
    hookError: unknown,
  ): void {
    const details = { primaryError, hookError };
    let reported = false;

    try {
      if (context.runtimeInspector) {
        context.runtimeInspector.recordEvent({
          requestId: context.requestId,
          kind: "error",
          outcome: "failed",
          name: "lifecycle.onRequestError",
          details,
        });
        reported = true;
      }
    } catch {
      reported = false;
    }
    if (reported) {
      return;
    }

    try {
      if (context.runtime?.logger) {
        context.runtime.logger.error("onRequestError hook failed", details);
        reported = true;
      }
    } catch {
      reported = false;
    }
    if (reported) {
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.error("[Context] onRequestError hook failed");
    } catch {
      return;
    }
  }
}
