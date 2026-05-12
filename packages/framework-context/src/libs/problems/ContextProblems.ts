import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 컨텍스트 미들웨어 실행 중 오류가 발생했을 때 사용하는 Problem입니다.
 */
export class MiddlewareProblem extends Problem {
  readonly code = "MIDDLEWARE_EXECUTION_ERROR";
  readonly category = ProblemCategory.InternalServerError;
}

/**
 * 기간 문자열 파싱이 실패했을 때 사용하는 Problem입니다.
 */
export class DurationParseProblem extends Problem {
  readonly code = "DURATION_PARSE_ERROR";
  readonly category = ProblemCategory.BadRequest;
}
