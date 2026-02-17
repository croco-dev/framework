import { Container } from '@croco/framework-context';
import { ProblemFactory } from '@croco/problems-core';
import type { CallHandler, ExceptionFilter, ExecutionContext, Guard, Interceptor } from '@croco/protocols-rest';
import { ErrorHandler } from './ErrorHandler';
import type { HttpExecutionContext } from './HttpExecutionContext';

export interface PipelineConfig {
  guards: Guard<ExecutionContext>[];
  interceptors: Interceptor<ExecutionContext>[];
  filters: ExceptionFilter<unknown, HttpExecutionContext>[];
}

export class PipelineRunner {
  private get errorHandler() {
    return Container.get(ErrorHandler);
  }

  async run(
    execContext: HttpExecutionContext,
    handler: () => Promise<unknown>,
    config: PipelineConfig
  ): Promise<unknown> {
    try {
      await this.runGuards(execContext, config.guards);

      return await this.runInterceptorChain(execContext, handler, config.interceptors);
    } catch (error) {
      return this.runFilters(error, execContext, config.filters);
    }
  }

  private async runGuards(context: ExecutionContext, guards: Guard<ExecutionContext>[]): Promise<void> {
    for (const guard of guards) {
      const canActivate = await guard.canActivate(context);
      if (!canActivate) {
        throw ProblemFactory.forbidden('ACCESS_DENIED', 'Access denied');
      }
    }
  }

  private async runInterceptorChain(
    context: ExecutionContext,
    handler: () => Promise<unknown>,
    interceptors: Interceptor<ExecutionContext>[]
  ): Promise<unknown> {
    if (interceptors.length === 0) {
      return handler();
    }

    let next: CallHandler = { handle: handler };

    for (let i = interceptors.length - 1; i >= 0; i--) {
      const interceptor = interceptors[i];
      const currentNext = next;
      next = {
        handle: () => interceptor.intercept(context, currentNext),
      };
    }

    return next.handle();
  }

  private runFilters(
    error: unknown,
    context: HttpExecutionContext,
    filters: ExceptionFilter<unknown, HttpExecutionContext>[]
  ): unknown {
    let nextError = error;

    for (const filter of filters) {
      try {
        return filter.catch(nextError, context);
      } catch (caughtError) {
        nextError = caughtError;
      }
    }

    return this.errorHandler.handleError(nextError, context.getHttpContext());
  }
}
