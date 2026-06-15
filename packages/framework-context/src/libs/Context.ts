import { AsyncLocalStorage } from "node:async_hooks";
import { MiddlewareChain } from "./MiddlewareChain";
import type {
  Constructor,
  LifecycleHooks,
  Middleware,
  RequestContext,
  RuntimeContext,
  RuntimePlatform,
} from "./types";

interface ContextData {
  context: RequestContext;
  createdAt: number;
  scopedCache: Map<string | Constructor, unknown>;
}

const contextStorage = new AsyncLocalStorage<ContextData>();

/**
 * AsyncLocalStorage 기반으로 요청 컨텍스트를 실행하고 조회하는 유틸리티입니다.
 */
export class Context {
  private static readonly STORAGE = contextStorage;

  static run<T>(context: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
    const data: ContextData = {
      context,
      createdAt: Date.now(),
      scopedCache: new Map(),
    };
    return Context.STORAGE.run(data, fn);
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

  static getCache(): Map<string | Constructor, unknown> | undefined {
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
    return Context.STORAGE.run(
      {
        context,
        createdAt: Date.now(),
        scopedCache: new Map(),
      },
      async () => {
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
          const normalizedError = error instanceof Error ? error : new Error(String(error));

          await hooks.onRequestError?.(context, normalizedError);
          throw error;
        }
      },
    );
  }
}
