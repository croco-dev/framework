/**
 * Middleware chain class for executing middleware in onion pattern
 */

import { MiddlewareProblem } from './problems/MiddlewareProblems';
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
  async execute<T>(ctx: TContext, finalFn?: () => Promise<T>): Promise<T> {
    const NO_RESULT = Symbol('NO_RESULT');
    let result: T | typeof NO_RESULT = NO_RESULT;
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new MiddlewareProblem('Middleware called next() multiple times');
      }
      index = i;

      if (i >= this.middlewares.length) {
        if (finalFn) {
          result = await finalFn();
        }
        return;
      }

      const middleware = this.middlewares[i];
      await middleware(ctx, async () => dispatch(i + 1));
    };

    await dispatch(0);

    if (result === NO_RESULT && finalFn) {
      throw new MiddlewareProblem('No result returned from function execution');
    }

    if (result === NO_RESULT) {
      return undefined as T;
    }

    return result;
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
  }
}
