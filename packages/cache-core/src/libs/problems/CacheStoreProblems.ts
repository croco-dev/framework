import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * RFC 7807 형식의 유효하지 않은 캐시 TTL 검증 문제입니다.
 */
export class InvalidCacheTtlProblem extends Problem {
  readonly code = "cache-core/invalid-ttl";
  readonly category = ProblemCategory.ValidationError;
  readonly receivedTtl: string;

  constructor(ttlMs: number) {
    const receivedTtl = String(ttlMs);
    super(
      "cache-core/invalid-ttl",
      ProblemCategory.ValidationError,
      `Cache TTL must be a finite, non-negative number of milliseconds; received ${receivedTtl}.`,
      { extensions: { receivedTtl } },
    );
    this.receivedTtl = receivedTtl;
  }
}
