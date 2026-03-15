/**
 * unknown 타입의 에러를 Error 인스턴스로 정규화합니다.
 *
 * @param error - 에러 객체 (unknown 타입)
 * @returns Error 인스턴스
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
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
