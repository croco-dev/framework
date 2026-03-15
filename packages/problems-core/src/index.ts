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
export type { ProblemDetails, ProblemOptions } from './libs/Problem';

/**
 * RFC 7807 Problem Details 형식을 제공하는 추상 에러 클래스입니다.
 *
 * @property code - 도메인에서 문제를 식별하는 고유 코드입니다.
 * @property category - HTTP 의미론과 매핑되는 문제 카테고리입니다.
 * @property [detail] - 문제의 상세 설명입니다.
 * @property type - 문제 유형 식별자 URI입니다.
 * @property [instance] - 특정 에러 발생 인스턴스를 식별하는 URI입니다.
 * @property [extensions] - Problem Details 확장 필드입니다.
 * @param code - 도메인에서 문제를 식별하는 고유 코드입니다.
 * @param category - HTTP 의미론과 매핑되는 문제 카테고리입니다.
 * @param detail - 문제의 상세 설명입니다.
 * @param options - RFC 7807 필드 확장을 위한 옵션입니다.
 *
 * @example
 * ```typescript
 * import { Problem, ProblemCategory } from '@croco/problems-core';
 *
 * class UserNotFoundProblem extends Problem {
 *   constructor(userId: string) {
 *     super('user/not-found', ProblemCategory.NotFound, `사용자(${userId})를 찾을 수 없습니다.`);
 *   }
 * }
 * ```
 */
export { Problem } from './libs/Problem';
/**
 * Problem의 도메인 분류와 HTTP 의미론을 연결하는 카테고리 열거형입니다.
 *
 * @property BadRequest - 잘못된 요청 형식 또는 파라미터 문제를 나타냅니다.
 * @property NotFound - 요청한 리소스를 찾을 수 없는 상태를 나타냅니다.
 * @property ValidationError - 입력 검증 실패를 나타냅니다.
 *
 * @example
 * ```typescript
 * import { ProblemCategory } from '@croco/problems-core';
 *
 * const category = ProblemCategory.ValidationError;
 * ```
 */
export { ProblemCategory } from './libs/ProblemCategory';
/**
 * ProblemCategory를 HTTP 응답용 status/title로 변환하는 매퍼입니다.
 *
 * @property toHttpStatus - 카테고리를 HTTP 상태 코드로 변환합니다.
 * @property toTitle - 카테고리를 사람이 읽을 수 있는 제목으로 변환합니다.
 *
 * @example
 * ```typescript
 * import { ProblemCategory, ProblemCategoryMapper } from '@croco/problems-core';
 *
 * const status = ProblemCategoryMapper.toHttpStatus(ProblemCategory.NotFound);
 * const title = ProblemCategoryMapper.toTitle(ProblemCategory.NotFound);
 * ```
 */
export { ProblemCategoryMapper } from './libs/ProblemCategoryMapper';
/**
 * 카테고리별 기본 Problem 인스턴스를 생성하는 팩토리입니다.
 *
 * @property badRequest - BadRequest 카테고리 Problem을 생성합니다.
 * @property notFound - NotFound 카테고리 Problem을 생성합니다.
 * @property internalServerError - InternalServerError 카테고리 Problem을 생성합니다.
 *
 * @example
 * ```typescript
 * import { ProblemFactory } from '@croco/problems-core';
 *
 * const problem = ProblemFactory.notFound('user/not-found', '사용자를 찾을 수 없습니다.');
 * const body = problem.toJSON();
 * ```
 */
export { ProblemFactory } from './libs/ProblemFactory';
/**
 * unknown 타입의 에러를 Error 인스턴스로 정규화하는 유틸리티 함수입니다.
 *
 * @property normalizeError - unknown 타입의 에러를 Error 인스턴스로 변환합니다.
 *
 * @example
 * ```typescript
 * import { normalizeError } from '@croco/problems-core';
 *
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const normalized = normalizeError(error);
 *   console.error(normalized.message);
 * }
 * ```
 */
export { normalizeError } from './libs/utils/normalizeError';
