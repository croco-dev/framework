import { Problem, type ProblemOptions } from "./Problem";
import { ProblemCategory } from "./ProblemCategory";

class GenericProblem extends Problem {
  // biome-ignore lint/complexity/noUselessConstructor: Problem's constructor is protected, so subclass needs explicit constructor
  constructor(code: string, category: ProblemCategory, detail?: string, options?: ProblemOptions) {
    super(code, category, detail, options);
  }
}

/**
 * 카테고리별 Problem 인스턴스를 생성하는 팩토리입니다.
 * 각 메서드는 해당 카테고리에 맞는 HTTP 상태 코드와 함께 Problem 인스턴스를 생성합니다.
 */
export const ProblemFactory = {
  /**
   * BadRequest (400) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  badRequest(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.BadRequest, detail, options);
  },
  /**
   * InvalidArgument (400) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  invalidArgument(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.BadRequest, detail, options);
  },
  /**
   * Unauthorized (401) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  unauthorized(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Unauthorized, detail, options);
  },
  /**
   * Forbidden (403) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  forbidden(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Forbidden, detail, options);
  },
  /**
   * NotFound (404) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  notFound(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.NotFound, detail, options);
  },
  /**
   * Conflict (409) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  conflict(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Conflict, detail, options);
  },
  /**
   * Gone (410) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  gone(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Gone, detail, options);
  },
  /**
   * PayloadTooLarge (413) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  payloadTooLarge(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.PayloadTooLarge, detail, options);
  },
  /**
   * ValidationError (422) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  validationError(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.ValidationError, detail, options);
  },
  /**
   * BusinessRuleViolation (422) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  businessRuleViolation(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.BusinessRuleViolation, detail, options);
  },
  /**
   * TooManyRequests (429) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  tooManyRequests(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.TooManyRequests, detail, options);
  },
  /**
   * InternalServerError (500) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  internalServerError(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.InternalServerError, detail, options);
  },
  /**
   * NotImplemented (501) 카테고리의 Problem을 생성합니다.
   * @param code - 도메인에서 문제를 식별하는 고유 코드
   * @param detail - 문제의 상세 설명
   * @param options - RFC 7807 필드 확장을 위한 옵션
   * @returns Problem 인스턴스
   */
  notImplemented(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.NotImplemented, detail, options);
  },
};
