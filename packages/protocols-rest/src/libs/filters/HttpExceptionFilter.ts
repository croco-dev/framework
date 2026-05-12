import type { ExceptionFilter } from "../interfaces/ExceptionFilter";
import type { ExecutionContext } from "../interfaces/ExecutionContext";

export type ProblemLike = {
  status: number;
  toJSON(): Record<string, unknown>;
};

export type HttpExceptionFilterResponse = {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

function isProblem(error: unknown): error is ProblemLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as ProblemLike).status === "number" &&
    "toJSON" in error &&
    typeof (error as ProblemLike).toJSON === "function"
  );
}

/**
 * 예외를 Problem Details 형식의 HTTP 응답으로 변환하는 기본 필터입니다.
 */
export class HttpExceptionFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(exception: unknown, _context: ExecutionContext): HttpExceptionFilterResponse {
    if (isProblem(exception)) {
      return {
        status: exception.status,
        headers: { "Content-Type": "application/problem+json" },
        body: exception.toJSON(),
      };
    }

    const message = exception instanceof Error ? exception.message : "Internal Server Error";

    return {
      status: 500,
      headers: { "Content-Type": "application/problem+json" },
      body: {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        detail: message,
      },
    };
  }
}
