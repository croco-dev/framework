import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidCliOptionProblem extends Problem {
  readonly code = "create-croco-app/invalid-cli-option";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string, recovery: string, option?: string) {
    super(undefined, undefined, detail, {
      extensions: {
        ...(option ? { option } : {}),
        recovery,
      },
    });
  }
}
