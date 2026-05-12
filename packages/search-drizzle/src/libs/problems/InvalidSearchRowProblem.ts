import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 검색 결과 행이 객체 형태가 아닐 때 발생하는 문제입니다.
 */
export class InvalidSearchRowProblem extends Problem {
  readonly code = "SEARCH_DRIZZLE_INVALID_ROW";
  readonly category = ProblemCategory.InternalServerError;
  /**
   * 잘못된 검색 결과 행 문제를 생성합니다.
   */
  constructor() {
    super(undefined, undefined, "Invalid search row: expected object result");
  }
}
