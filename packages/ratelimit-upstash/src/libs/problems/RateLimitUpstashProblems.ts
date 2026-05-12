import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 저장소 타입과 정책 타입이 맞지 않을 때 발생하는 문제입니다.
 */
export class InvalidRateLimitPolicyProblem extends Problem {
  readonly code = "ratelimit-upstash/invalid-policy";
  readonly category = ProblemCategory.InternalServerError;

  constructor(storeType: string) {
    super(undefined, undefined, `Invalid policy for ${storeType} store`);
  }
}
