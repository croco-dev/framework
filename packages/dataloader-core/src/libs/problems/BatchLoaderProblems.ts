import { Problem, ProblemCategory } from "@croco/problems-core";

export class BatchResultLengthMismatchProblem extends Problem {
  readonly code = "dataloader-core/batch-result-length-mismatch";
  readonly category = ProblemCategory.InternalServerError;
  constructor(expected: number, actual: number) {
    super(
      undefined,
      undefined,
      `BatchLoader: batch function returned ${actual} results, expected ${expected}`,
    );
  }
}

export class DuplicateBatchLoaderNameProblem extends Problem {
  readonly code = "dataloader-core/duplicate-loader-name";
  readonly category = ProblemCategory.InternalServerError;
  constructor(name: string, scope: string | null, dynamicScope: string | null) {
    super(
      undefined,
      undefined,
      `BatchLoader: name '${name}' is already used by a different loader for the same scope in this request; create each loader once and reuse it, or give it a unique name or scope`,
      { extensions: { name, scope, dynamicScope } },
    );
  }
}

export class InvalidBatchLoaderConfigurationError extends Error {
  readonly name = "InvalidBatchLoaderConfigurationError";

  constructor(message: string) {
    super(`Invalid BatchLoader configuration: ${message}`);
  }
}
