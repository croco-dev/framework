import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 테넌트 토큰 옵션 없이 토큰 발급을 시도할 때 발생하는 문제입니다.
 */
export class TenantTokenNotConfiguredProblem extends Problem {
  readonly code = "search-meilisearch/tenant-token-not-configured";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "Tenant token options are not configured");
  }
}
