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
export { HttpStatus } from './libs/HttpStatus';
export type { ProblemDetails, ProblemOptions } from './libs/Problem';
export { Problem } from './libs/Problem';
export { ProblemCategory } from './libs/ProblemCategory';
export { ProblemCategoryMapper, toHttpStatus, toTitle } from './libs/ProblemCategoryMapper';
export {
  isValidExtensions,
  type ProblemExtensions,
  validateExtensions,
} from './libs/ProblemExtensions';
export { ProblemFactory } from './libs/ProblemFactory';
export { ProblemSerializer } from './libs/ProblemSerializer';
