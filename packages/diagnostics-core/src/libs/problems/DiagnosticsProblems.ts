import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 같은 이름으로 서로 다른 diagnostics provider가 등록될 때 발생하는 Problem입니다.
 */
export class DuplicateDiagnosticsProviderProblem extends Problem {
  readonly code = "diagnostics-core/duplicate-provider";
  readonly category = ProblemCategory.InternalServerError;

  constructor(providerName: string) {
    super(undefined, undefined, `Diagnostics provider '${providerName}' is already registered`, {
      extensions: {
        providerName,
        retryable: false,
      },
    });
  }
}
