import { Problem, ProblemCategoryMapper, type ProblemDetails } from '@croco/problems-core';
import type { CrocoHttpContext } from './types';

export class ErrorHandler {
  handleError(error: unknown, ctx: CrocoHttpContext): Response {
    if (error instanceof Problem) {
      return this.handleProblem(error, ctx);
    }

    if (error instanceof Error) {
      return this.handleGenericError(error, ctx);
    }

    return ctx.jsonResponse(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
      },
      500
    );
  }

  private handleProblem(problem: Problem, ctx: CrocoHttpContext): Response {
    const status = ProblemCategoryMapper.toHttpStatus(problem.category);
    const body: ProblemDetails = {
      type: problem.type,
      title: problem.title,
      status,
      code: problem.code,
      detail: problem.detail,
      instance: ctx.req.url,
      ...problem.extensions,
    };

    return ctx.jsonResponse(body, status);
  }

  private handleGenericError(error: Error, ctx: CrocoHttpContext): Response {
    console.error('Unhandled error:', error);

    return ctx.jsonResponse(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : error.message,
      },
      500
    );
  }
}
