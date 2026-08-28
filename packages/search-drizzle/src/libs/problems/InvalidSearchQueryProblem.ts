import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Drizzle PostgreSQL 검색 쿼리 옵션이 안전하게 SQL로 컴파일될 수 없을 때 발생하는 문제입니다.
 */
export class InvalidSearchQueryProblem extends Problem {
  static readonly CODE = "search-drizzle/invalid-query";

  /**
   * 잘못된 검색 쿼리 옵션 문제를 생성합니다.
   */
  constructor(option: string, reason: string) {
    super(
      InvalidSearchQueryProblem.CODE,
      ProblemCategory.ValidationError,
      `Invalid search query option '${option}': ${reason}`,
      {
        extensions: {
          option,
          reason,
          retryable: false,
        },
      },
    );
  }
}
