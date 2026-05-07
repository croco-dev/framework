/**
 * RFC 7807 Problem Details의 확장 필드 타입입니다.
 * 키-값 쌍 형태로 추가 메타데이터를 포함할 수 있습니다.
 *
 * @see validateExtensions - 확장 필드 검증 함수는 validators/validateExtensions.ts에 위치
 */
export type ProblemExtensions = Record<string, unknown>;
