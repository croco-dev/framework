import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Quota exceeded 시 HTTP 429 TooManyRequests를 반환합니다.
 * @breaking-change 이전 버전(403 Forbidden)과의 호환성이 필요하면 API Gateway에서 응답 코드 매핑이 필요합니다.
 */
export class QuotaExceededProblem extends Problem {
  constructor(meterId: string, currentUsage: number, quota: number) {
    super(
      "metering/quota-exceeded",
      ProblemCategory.TooManyRequests,
      `Quota exceeded for meter '${meterId}': current usage ${currentUsage} exceeds quota ${quota}`,
      {
        extensions: {
          meterId,
          currentUsage,
          quota,
        },
      },
    );
  }
}
