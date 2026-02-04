/**
 * Component scope types
 */
export type Scope = 'singleton' | 'request' | 'transient';

/**
 * Generic constructor type
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic constructor requires any for arguments
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Component options for @Component decorator
 */
export interface ComponentOptions {
  scope?: Scope;
}

/**
 * Internal component metadata
 */
export interface ComponentMetadata {
  scope: Scope;
  target: Constructor;
}

/**
 * User information in request context
 */
export type UserContext = {
  id: string;
  email?: string;
  [key: string]: unknown;
};

/**
 * Request context data
 */
export interface RequestContext {
  requestId: string;
  user?: UserContext;
  tenantId?: string;
  traceId?: string;
}

/**
 * Onion middleware function type
 * Similar to Koa middleware pattern
 */
export type Middleware<TContext = RequestContext> = (ctx: TContext, next: () => Promise<void>) => Promise<void>;

/**
 * Middleware chain class for executing middleware in onion pattern
 */
export class MiddlewareChain<TContext = RequestContext> {
  private middlewares: Array<Middleware<TContext>> = [];

  /**
   * Add middleware to the chain
   */
  use(middleware: Middleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute middleware chain in onion pattern
   */
  async execute(ctx: TContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('Middleware called next() multiple times');
      }
      index = i;

      if (i >= this.middlewares.length) {
        return;
      }

      const middleware = this.middlewares[i];
      await middleware(ctx, async () => dispatch(i + 1));
    };

    await dispatch(0);
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
  }
}

/**
 * Lifecycle hooks for request scope
 */
export interface LifecycleHooks<TContext = RequestContext> {
  /**
   * Called when request starts, before middleware chain
   */
  onRequestStart?: (ctx: TContext) => Promise<void> | void;

  /**
   * Called when request ends successfully, after middleware chain
   */
  onRequestEnd?: (ctx: TContext, result?: unknown) => Promise<void> | void;

  /**
   * Called when request encounters an error
   */
  onRequestError?: (ctx: TContext, error: Error) => Promise<void> | void;
}
