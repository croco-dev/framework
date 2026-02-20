import { AsyncLocalStorage } from 'node:async_hooks';
import { trace } from '@opentelemetry/api';
import type { LifecycleHooks, Middleware, RequestContext } from './types';

interface ContextData {
  context: RequestContext;
  createdAt: number;
  scopedCache: Map<string, unknown>;
}

const contextStorage = new AsyncLocalStorage<ContextData>();

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

  static getCurrentUser(): RequestContext['user'] | null {
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

  static getCache(): Map<string, unknown> | undefined {
    return Context.STORAGE.getStore()?.scopedCache;
  }

  /**
   * Get active trace ID from OpenTelemetry context
   * Falls back to RequestContext.traceId for propagation
   */
  static getActiveTraceId(): string | null {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return spanContext.traceId;
    }

    // Fallback to RequestContext.traceId for propagation
    const context = Context.get();
    return context?.traceId ?? null;
  }

  /**
   * Get active span ID from OpenTelemetry context
   */
  static getActiveSpanId(): string | null {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return spanContext.spanId;
    }

    return null;
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
    fn: () => Promise<T>
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

          const result =
            middlewares.length > 0 ? await Context.executeMiddlewares(context, middlewares, fn) : await fn();

          await hooks.onRequestEnd?.(context, result);

          return result;
        } catch (error) {
          if (error instanceof Error) {
            await hooks.onRequestError?.(context, error);
          }
          throw error;
        }
      }
    );
  }

  private static async executeMiddlewares<T>(
    context: RequestContext,
    middlewares: Middleware[],
    fn: () => Promise<T>
  ): Promise<T> {
    const NO_RESULT = Symbol('NO_RESULT');
    let result: T | typeof NO_RESULT = NO_RESULT;
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('Middleware called next() multiple times');
      }
      index = i;

      if (i >= middlewares.length) {
        result = await fn();
        return;
      }

      const middleware = middlewares[i];
      await middleware(context, async () => dispatch(i + 1));
    };

    await dispatch(0);

    if (result === NO_RESULT) {
      throw new Error('No result returned from function execution');
    }

    return result;
  }
}
