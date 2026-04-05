/**
 * RFC 7807 Problem Details의 확장 필드 타입입니다.
 * 키-값 쌍 형태로 추가 메타데이터를 포함할 수 있습니다.
 */
export type ProblemExtensions = Record<string, unknown>;

/**
 * 확장 필드를 검증하고 ProblemExtensions 타입으로 변환합니다.
 * @param extensions - 검증할 확장 필드 객체
 * @returns 검증된 ProblemExtensions
 * @throws {Error} extensions가 객체가 아닌 경우
 */
export function validateExtensions(extensions: unknown): ProblemExtensions {
  if (typeof extensions !== 'object' || extensions === null) {
    throw new Error('Extensions must be an object');
  }
  return extensions as ProblemExtensions;
}

/**
 * 확장 필드가 유효한지 확인합니다.
 * @param extensions - 확인할 확장 필드
 * @returns 유효성 여부
 */
export function isValidExtensions(extensions: unknown): boolean {
  return typeof extensions === 'object' && extensions !== null;
}
