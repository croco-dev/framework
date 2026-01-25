import { Context, type LifecycleHooks, type Middleware } from '../index';

describe('MiddlewareChain', () => {
  describe('Onion pattern execution', () => {
    it('should execute middleware in onion pattern', async () => {
      const executionOrder: string[] = [];

      const middleware1: Middleware = async (ctx, next) => {
        executionOrder.push('middleware1-before');
        await next();
        executionOrder.push('middleware1-after');
      };

      const middleware2: Middleware = async (ctx, next) => {
        executionOrder.push('middleware2-before');
        await next();
        executionOrder.push('middleware2-after');
      };

      const context = { requestId: 'test-123' };
      const hooks: LifecycleHooks = {};

      const result = await Context.runWithMiddleware(context, [middleware1, middleware2], hooks, async () => {
        executionOrder.push('handler');
        return 'result';
      });

      expect(result).toBe('result');
      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should execute single middleware correctly', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware-before');
        await next();
        executionOrder.push('middleware-after');
      };

      const context = { requestId: 'test-456' };
      const hooks: LifecycleHooks = {};

      const result = await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        executionOrder.push('handler');
        return 'single-result';
      });

      expect(result).toBe('single-result');
      expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after']);
    });

    it('should execute with no middlewares', async () => {
      const executionOrder: string[] = [];
      const context = { requestId: 'test-789' };
      const hooks: LifecycleHooks = {};

      const result = await Context.runWithMiddleware(context, [], hooks, async () => {
        executionOrder.push('handler');
        return 'no-middleware-result';
      });

      expect(result).toBe('no-middleware-result');
      expect(executionOrder).toEqual(['handler']);
    });

    it('should handle nested middleware calls', async () => {
      const executionOrder: string[] = [];

      const middleware1: Middleware = async (ctx, next) => {
        executionOrder.push('m1-before');
        await next();
        executionOrder.push('m1-after');
      };

      const middleware2: Middleware = async (ctx, next) => {
        executionOrder.push('m2-before');
        await next();
        executionOrder.push('m2-after');
      };

      const middleware3: Middleware = async (ctx, next) => {
        executionOrder.push('m3-before');
        await next();
        executionOrder.push('m3-after');
      };

      const context = { requestId: 'test-nested' };
      const hooks: LifecycleHooks = {};

      const result = await Context.runWithMiddleware(
        context,
        [middleware1, middleware2, middleware3],
        hooks,
        async () => {
          executionOrder.push('handler');
          return 'nested-result';
        }
      );

      expect(result).toBe('nested-result');
      expect(executionOrder).toEqual([
        'm1-before',
        'm2-before',
        'm3-before',
        'handler',
        'm3-after',
        'm2-after',
        'm1-after',
      ]);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from handler', async () => {
      const middleware: Middleware = async (ctx, next) => {
        await next();
      };

      const context = { requestId: 'test-error' };
      const hooks: LifecycleHooks = {};
      const testError = new Error('Handler error');

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          throw testError;
        })
      ).rejects.toThrow('Handler error');
    });

    it('should propagate errors from middleware', async () => {
      const middleware: Middleware = async (ctx, next) => {
        throw new Error('Middleware error');
      };

      const context = { requestId: 'test-middleware-error' };
      const hooks: LifecycleHooks = {};

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          return 'result';
        })
      ).rejects.toThrow('Middleware error');
    });

    it('should propagate errors from middleware before handler', async () => {
      const middleware1: Middleware = async (ctx, next) => {
        throw new Error('Middleware1 error');
      };

      const middleware2: Middleware = async (ctx, next) => {
        await next();
      };

      const context = { requestId: 'test-mid-error' };
      const hooks: LifecycleHooks = {};

      await expect(
        Context.runWithMiddleware(context, [middleware1, middleware2], hooks, async () => {
          return 'result';
        })
      ).rejects.toThrow('Middleware1 error');
    });

    it('should catch errors in onRequestError hook', async () => {
      const middleware: Middleware = async (ctx, next) => {
        await next();
      };

      const context = { requestId: 'test-hook-error' };
      const errorLog: Error[] = [];
      const testError = new Error('Test error');
      const hooks: LifecycleHooks = {
        onRequestError: (ctx, error) => {
          errorLog.push(error);
        },
      };

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');

      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toBe(testError);
    });
  });

  describe('Lifecycle hooks', () => {
    it('should call onRequestStart before middleware chain', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        await next();
      };

      const context = { requestId: 'test-start-hook' };
      const hooks: LifecycleHooks = {
        onRequestStart: (ctx) => {
          executionOrder.push('onRequestStart');
        },
      };

      await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        executionOrder.push('handler');
        return 'result';
      });

      expect(executionOrder).toEqual(['onRequestStart', 'middleware', 'handler']);
    });

    it('should call onRequestEnd after successful execution', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        await next();
      };

      const context = { requestId: 'test-end-hook' };
      const resultLog: unknown[] = [];
      const hooks: LifecycleHooks = {
        onRequestEnd: (ctx, result) => {
          executionOrder.push('onRequestEnd');
          resultLog.push(result);
        },
      };

      const result = await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        executionOrder.push('handler');
        return 'hook-result';
      });

      expect(result).toBe('hook-result');
      expect(executionOrder).toEqual(['middleware', 'handler', 'onRequestEnd']);
      expect(resultLog).toEqual(['hook-result']);
    });

    it('should call onRequestError when error occurs', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        await next();
      };

      const context = { requestId: 'test-error-hook' };
      const errorLog: Error[] = [];
      const testError = new Error('Hook test error');
      const hooks: LifecycleHooks = {
        onRequestError: (ctx, error) => {
          executionOrder.push('onRequestError');
          errorLog.push(error);
        },
      };

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          executionOrder.push('handler');
          throw testError;
        })
      ).rejects.toThrow('Hook test error');

      expect(executionOrder).toEqual(['middleware', 'handler', 'onRequestError']);
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toBe(testError);
    });

    it('should call onRequestError on middleware error', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        throw new Error('Middleware hook error');
      };

      const context = { requestId: 'test-mid-error-hook' };
      const errorLog: Error[] = [];
      const hooks: LifecycleHooks = {
        onRequestError: (ctx, error) => {
          executionOrder.push('onRequestError');
          errorLog.push(error);
        },
      };

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          executionOrder.push('handler');
          return 'result';
        })
      ).rejects.toThrow('Middleware hook error');

      expect(executionOrder).toEqual(['middleware', 'onRequestError']);
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0].message).toBe('Middleware hook error');
    });

    it('should call complete lifecycle: start -> middlewares -> end', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        await next();
      };

      const context = { requestId: 'test-lifecycle' };
      const hooks: LifecycleHooks = {
        onRequestStart: () => {
          executionOrder.push('start');
        },
        onRequestEnd: () => {
          executionOrder.push('end');
        },
      };

      await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        executionOrder.push('handler');
        return 'complete';
      });

      expect(executionOrder).toEqual(['start', 'middleware', 'handler', 'end']);
    });

    it('should call complete lifecycle on error: start -> middlewares -> error', async () => {
      const executionOrder: string[] = [];

      const middleware: Middleware = async (ctx, next) => {
        executionOrder.push('middleware');
        await next();
      };

      const context = { requestId: 'test-lifecycle-error' };
      const hooks: LifecycleHooks = {
        onRequestStart: () => {
          executionOrder.push('start');
        },
        onRequestError: () => {
          executionOrder.push('error');
        },
      };

      await expect(
        Context.runWithMiddleware(context, [middleware], hooks, async () => {
          executionOrder.push('handler');
          throw new Error('Lifecycle error');
        })
      ).rejects.toThrow('Lifecycle error');

      expect(executionOrder).toEqual(['start', 'middleware', 'handler', 'error']);
    });
  });

  describe('Context integration', () => {
    it('should have active context inside middleware', async () => {
      let contextFromMiddleware: unknown = null;

      const middleware: Middleware = async (ctx, next) => {
        contextFromMiddleware = ctx;
        await next();
      };

      const context = { requestId: 'test-context-access' };
      const hooks: LifecycleHooks = {};

      await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        return 'result';
      });

      expect(contextFromMiddleware).toBe(context);
      expect(contextFromMiddleware).toHaveProperty('requestId', 'test-context-access');
    });

    it('should have active context inside handler', async () => {
      const middleware: Middleware = async (ctx, next) => {
        await next();
      };

      const context = { requestId: 'test-handler-context' };
      const hooks: LifecycleHooks = {};
      let contextFromHandler: unknown = null;

      await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        contextFromHandler = Context.get();
        return 'result';
      });

      expect(contextFromHandler).toBe(context);
    });

    it('should have active context in hooks', async () => {
      const middleware: Middleware = async (ctx, next) => {
        await next();
      };

      const context = { requestId: 'test-hook-context' };
      const hookContexts: unknown[] = [];

      const hooks: LifecycleHooks = {
        onRequestStart: (ctx) => {
          hookContexts.push({ hook: 'start', context: ctx });
        },
        onRequestEnd: (ctx) => {
          hookContexts.push({ hook: 'end', context: ctx });
        },
      };

      await Context.runWithMiddleware(context, [middleware], hooks, async () => {
        return 'result';
      });

      expect(hookContexts).toHaveLength(2);
      expect(hookContexts[0]).toEqual({ hook: 'start', context });
      expect(hookContexts[1]).toEqual({ hook: 'end', context });
    });
  });
});
