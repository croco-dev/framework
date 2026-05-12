import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 같은 오류 타입에 대한 Recover 핸들러가 중복 등록되면 발생하는 Problem입니다.
 */
export class DuplicateRecoverHandlerProblem extends Problem {
  readonly code = "DUPLICATE_RECOVER_HANDLER";
  readonly category = ProblemCategory.InternalServerError;

  constructor(methodName: string, exceptionTypeName: string) {
    super(
      "DUPLICATE_RECOVER_HANDLER",
      ProblemCategory.InternalServerError,
      `Duplicate recover handler detected for '${exceptionTypeName}' on method '${methodName}'`,
    );
  }
}
