import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 검색 결과 행, 관련도 점수 또는 전체 건수 행이 예상한 형태가 아닐 때 발생하는 문제입니다.
 */
export class InvalidSearchRowProblem extends Problem {
  readonly code = "SEARCH_DRIZZLE_INVALID_ROW";
  readonly category = ProblemCategory.InternalServerError;
  /**
   * 잘못된 검색 결과 행 문제를 생성합니다.
   */
  constructor(reason = "expected object result") {
    super(undefined, undefined, `Invalid search row: ${reason}`);
  }
}
