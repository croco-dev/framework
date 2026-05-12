/**
 * RFC 7807 Problem Details의 직렬화 타입과 옵션 타입입니다.
 *
 * @property ProblemDetails - `Problem#toJSON()`이 반환하는 RFC 7807 구조입니다.
 * @property ProblemOptions - `Problem` 생성 시 확장 필드를 전달하는 옵션입니다.
 *
 * @example
 * ```typescript
 * import type { ProblemDetails, ProblemOptions } from '@croco/problems-core';
 *
 * const options: ProblemOptions = {
 *   type: 'https://docs.croco.dev/problems/user/not-found',
 * };
 *
 * const details: ProblemDetails = {
 *   type: 'about:blank',
 *   title: 'Not Found',
 *   status: 404,
 *   code: 'user/not-found',
 * };
 * ```
 */

/**
 * HTTP 상태 코드 상수입니다.
 *
 * @property PAYLOAD_TOO_LARGE - 413 Payload Too Large
 * @property NOT_FOUND - 404 Not Found
 * @property INTERNAL_SERVER_ERROR - 500 Internal Server Error
 *
 * @example
 * ```typescript
 * import { HttpStatus } from '@croco/problems-core';
 *
 * return HttpStatus.PAYLOAD_TOO_LARGE; // 413
 * ```
 */
export { HttpStatus } from "./libs/HttpStatus";
export type { ProblemDetails, ProblemOptions } from "./libs/Problem";

/**
 * RFC 7807 Problem Details를 표현하는 기본 추상 에러 클래스입니다.
 */
export { Problem } from "./libs/Problem";

/**
 * Problem을 HTTP 의미에 맞게 분류하는 카테고리 열거형입니다.
 */
export { ProblemCategory } from "./libs/ProblemCategory";

/**
 * ProblemCategory를 HTTP 상태 코드와 제목으로 매핑하는 유틸리티입니다.
 */
export { ProblemCategoryMapper, toHttpStatus, toTitle } from "./libs/ProblemCategoryMapper";
export type { ProblemExtensions } from "./libs/ProblemExtensions";
/**
 * 자주 쓰는 Problem 인스턴스를 빠르게 생성하는 팩토리입니다.
 */
export { ProblemFactory } from "./libs/ProblemFactory";
/**
 * Problem Details를 직렬화하고 역직렬화하는 유틸리티입니다.
 */
export { ProblemSerializer } from "./libs/ProblemSerializer";
export { isValidExtensions, validateExtensions } from "./libs/validators/validateExtensions";
