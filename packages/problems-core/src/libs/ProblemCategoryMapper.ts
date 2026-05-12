import { ProblemCategory } from "./ProblemCategory";

/**
 * ProblemCategory를 HTTP 상태 코드로 변환합니다.
 * @param category - 변환할 ProblemCategory
 * @returns 해당 카테고리에 해당하는 HTTP 상태 코드
 * @throws {Error} 처리되지 않은 카테고리인 경우
 */
export function toHttpStatus(category: ProblemCategory): number {
  switch (category) {
    case ProblemCategory.BadRequest:
      return 400;
    case ProblemCategory.Unauthorized:
      return 401;
    case ProblemCategory.Forbidden:
      return 403;
    case ProblemCategory.NotFound:
      return 404;
    case ProblemCategory.Conflict:
      return 409;
    case ProblemCategory.Gone:
      return 410;
    case ProblemCategory.ValidationError:
      return 422;
    case ProblemCategory.BusinessRuleViolation:
      return 422;
    case ProblemCategory.TooManyRequests:
      return 429;
    case ProblemCategory.InternalServerError:
      return 500;
    case ProblemCategory.NotImplemented:
      return 501;
    default: {
      const _exhaustiveCheck: never = category;
      throw new Error(`Unhandled ProblemCategory: ${String(_exhaustiveCheck)}`);
    }
  }
}

/**
 * ProblemCategory를 사람이 읽을 수 있는 제목으로 변환합니다.
 * @param category - 변환할 ProblemCategory
 * @returns 해당 카테고리의 제목 문자열
 * @throws {Error} 처리되지 않은 카테고리인 경우
 */
export function toTitle(category: ProblemCategory): string {
  switch (category) {
    case ProblemCategory.BadRequest:
      return "Bad Request";
    case ProblemCategory.Unauthorized:
      return "Unauthorized";
    case ProblemCategory.Forbidden:
      return "Forbidden";
    case ProblemCategory.NotFound:
      return "Not Found";
    case ProblemCategory.Conflict:
      return "Conflict";
    case ProblemCategory.Gone:
      return "Gone";
    case ProblemCategory.ValidationError:
      return "Validation Error";
    case ProblemCategory.BusinessRuleViolation:
      return "Business Rule Violation";
    case ProblemCategory.TooManyRequests:
      return "Too Many Requests";
    case ProblemCategory.InternalServerError:
      return "Internal Server Error";
    case ProblemCategory.NotImplemented:
      return "Not Implemented";
    default: {
      const _exhaustiveCheck: never = category;
      throw new Error(`Unhandled ProblemCategory: ${String(_exhaustiveCheck)}`);
    }
  }
}

/**
 * ProblemCategory와 HTTP 상태 코드 및 제목 간의 매핑을 제공합니다.
 * RFC 7807 Problem Details 형식과 호환됩니다.
 */
export const ProblemCategoryMapper = {
  toHttpStatus,
  toTitle,
};
