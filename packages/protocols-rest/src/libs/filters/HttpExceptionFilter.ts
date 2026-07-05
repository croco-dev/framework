import { Problem, ProblemSerializer } from "@croco/problems-core";
import type { ProblemDetails } from "@croco/problems-core";
import type { ExceptionFilter, HttpExceptionFilterResponse } from "../interfaces/ExceptionFilter";
import type { ExecutionContext } from "../interfaces/ExecutionContext";

export type ProblemLike = Problem | ProblemDetails;
export type { HttpExceptionFilterResponse } from "../interfaces/ExceptionFilter";

function parseProblemDetails(exception: unknown): ProblemDetails | undefined {
  if (exception instanceof Problem) {
    return exception.toJSON();
  }

  try {
    return ProblemSerializer.fromJson(exception);
  } catch {
    return undefined;
  }
}

/**
 * 예외를 Problem Details 형식의 HTTP 응답으로 변환하는 기본 필터입니다.
 */
export class HttpExceptionFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(exception: unknown, _context: ExecutionContext): HttpExceptionFilterResponse {
    const problem = parseProblemDetails(exception);

    if (problem) {
      return {
        status: problem.status,
        headers: { "Content-Type": "application/problem+json" },
        body: problem,
      };
    }

    return {
      status: 500,
      headers: { "Content-Type": "application/problem+json" },
      body: {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        detail: "An internal error occurred",
      },
    };
  }
}
