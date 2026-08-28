import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidIdPrefixProblem extends Problem {
  readonly code = "gid-core/invalid-id-prefix";
  readonly category = ProblemCategory.ValidationError;

  constructor(length: number, minimumLength: number) {
    super(
      undefined,
      undefined,
      `Prefix must be at least ${minimumLength} characters long, but got ${length}`,
    );
  }
}
