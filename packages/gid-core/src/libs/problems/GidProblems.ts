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

export class IdPrefixProblem extends Problem {
  readonly code = "gid-core/id-type-only-property";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "Id is a type-only property and should not be accessed at runtime");
  }
}
