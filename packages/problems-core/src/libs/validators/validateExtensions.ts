import type { ProblemExtensions } from "../ProblemExtensions";
import { InvalidExtensionsProblem } from "../problems/InvalidExtensionsProblem";

/**
 * 확장 필드를 검증하고 ProblemExtensions 타입으로 변환합니다.
 * @param extensions - 검증할 확장 필드 객체
 * @returns 검증된 ProblemExtensions
 * @throws {InvalidExtensionsProblem} extensions가 객체가 아닌 경우
 */
export function validateExtensions(extensions: unknown): ProblemExtensions {
  if (typeof extensions !== "object" || extensions === null) {
    throw new InvalidExtensionsProblem();
  }
  return extensions as ProblemExtensions;
}

/**
 * 확장 필드가 유효한지 확인합니다.
 * @param extensions - 확인할 확장 필드
 * @returns 유효성 여부
 */
export function isValidExtensions(extensions: unknown): boolean {
  return typeof extensions === "object" && extensions !== null;
}
