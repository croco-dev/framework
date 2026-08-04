import { Problem, ProblemCategory } from "@croco/problems-core";

export const MAX_DIAGNOSTICS_TIMEOUT_MS = 2_147_483_647;

export type DiagnosticsTimeoutSource = "default" | "provider";

/** Diagnostics timeout configuration cannot be represented safely by a Node.js timer. */
export class InvalidDiagnosticsTimeoutProblem extends Problem {
  readonly code = "diagnostics-core/invalid-timeout";
  readonly category = ProblemCategory.ValidationError;

  constructor(source: DiagnosticsTimeoutSource, timeoutMs: number) {
    super(
      undefined,
      undefined,
      `Diagnostics ${source} timeout must be an integer between 1 and ${MAX_DIAGNOSTICS_TIMEOUT_MS} milliseconds; received ${timeoutMs}`,
    );
  }
}

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
