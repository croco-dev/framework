/**
 * Middleware chain class for executing middleware in onion pattern
 */
import type { Middleware } from './types';

export class MiddlewareChain<TContext = Record<string, unknown>> {
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
