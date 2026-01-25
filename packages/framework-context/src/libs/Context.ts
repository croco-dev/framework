import { AsyncLocalStorage } from 'node:async_hooks';
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
    let result: T | undefined;
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

    if (result === undefined) {
      throw new Error('No result returned from function execution');
    }

    return result as T;
  }
}
