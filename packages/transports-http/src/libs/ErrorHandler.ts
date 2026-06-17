import { Component, type ILogger } from "@croco/framework-context";
import { Problem, ProblemCategoryMapper, type ProblemDetails } from "@croco/problems-core";
import type { CrocoHttpContext } from "./types";

@Component()
/**
 * 일반 예외와 Problem 예외를 HTTP 응답으로 변환하는 기본 에러 핸들러입니다.
 */
export class ErrorHandler {
  constructor(private readonly logger: ILogger) {}

  handleError(error: unknown, ctx: CrocoHttpContext): Response {
    if (error instanceof Problem) {
      return this.handleProblem(error, ctx);
    }

    if (error instanceof Error) {
      return this.handleGenericError(error, ctx);
    }

    return ctx.jsonResponse(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "An unexpected error occurred",
      },
      500,
    );
  }

  private handleProblem(problem: Problem, ctx: CrocoHttpContext): Response {
    const status = ProblemCategoryMapper.toHttpStatus(problem.category);
    const reservedFields = new Set(["type", "title", "status", "code", "detail", "instance"]);

    const safeExtensions = Object.entries(problem.extensions ?? {}).reduce(
      (acc, [key, value]) => {
        if (!reservedFields.has(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const body: ProblemDetails = {
      type: problem.type,
      title: problem.title,
      status,
      code: problem.code,
      detail: problem.detail,
      instance: ctx.req.url,
      ...safeExtensions,
    };

    return ctx.jsonResponse(body, status);
  }

  private handleGenericError(error: Error, ctx: CrocoHttpContext): Response {
    this.logger.error("Unhandled error:", error);

    return ctx.jsonResponse(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "An internal error occurred",
      },
      500,
    );
  }
}
