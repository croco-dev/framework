import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidBatchStepNameProblem extends Problem {
  readonly code = "batch-core/invalid-step-name";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly stepName: string) {
    super(
      undefined,
      undefined,
      `Batch step name must contain at least one non-whitespace character; received ${JSON.stringify(stepName)}.`,
      {
        extensions: {
          stepName,
          retryable: false,
        },
      },
    );
  }
}

export class DuplicateBatchStepNameProblem extends Problem {
  readonly code = "batch-core/duplicate-step-name";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly stepName: string) {
    super(undefined, undefined, `Batch job contains duplicate step name '${stepName}'.`, {
      extensions: {
        stepName,
        retryable: false,
      },
    });
  }
}

export function assertValidBatchStepName(stepName: unknown): asserts stepName is string {
  if (typeof stepName !== "string" || stepName.trim().length === 0) {
    throw new InvalidBatchStepNameProblem(String(stepName));
  }
}
