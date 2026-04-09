import type { Guard, ILogger } from '@croco/framework-context';
import { ProblemFactory } from '@croco/problems-core';
import type { CallHandler, ExceptionFilter, ExecutionContext, Interceptor } from '@croco/protocols-rest';
import type { ErrorHandler } from './ErrorHandler';
import type { HttpExecutionContext } from './HttpExecutionContext';

type FilterResponse = {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

function isFilterResponse(value: unknown): value is FilterResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'headers' in value &&
    'body' in value &&
    typeof (value as FilterResponse).status === 'number'
  );
}

export interface PipelineConfig {
  guards: Guard<ExecutionContext>[];
  interceptors: Interceptor<ExecutionContext>[];
  filters: ExceptionFilter<unknown, HttpExecutionContext>[];
}

/**
 * Guard, Interceptor, Filter 체인을 조합해 컨트롤러 핸들러를 실행합니다.
 */
export class PipelineRunner {
  constructor(
    private readonly errorHandler: ErrorHandler,
    private readonly logger: ILogger
  ) {}

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
    const nextError = error;

    for (const filter of filters) {
      try {
        const result = filter.catch(nextError, context);
        // If the filter returned a proper Response, use it directly.
        // Otherwise convert the plain object { status, headers, body } into a Response.
        if (result instanceof Response) {
          return result;
        }
        if (isFilterResponse(result)) {
          const httpCtx = context.getHttpContext();
          const response = httpCtx.jsonResponse(result.body, result.status);
          // Apply custom headers from the filter (e.g. Content-Type: application/problem+json)
          for (const [key, value] of Object.entries(result.headers)) {
            response.headers.set(key, value);
          }
          return response;
        }
        return result;
      } catch (caughtError) {
        this.logger.warn('Exception filter threw while handling an error; preserving original error', {
          originalError: nextError instanceof Error ? nextError.message : String(nextError),
          filterError: caughtError instanceof Error ? caughtError.message : String(caughtError),
        });
      }
    }

    return this.errorHandler.handleError(nextError, context.getHttpContext());
  }
}
