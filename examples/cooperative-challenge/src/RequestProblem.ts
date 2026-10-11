import { Problem, ProblemCategory } from "@croco/problems-core";

export class RequestProblem extends Problem {
  constructor(
    detail: string,
    readonly response?: Readonly<{ status: number; code?: string }>,
  ) {
    super("challenge-example/request-failed", ProblemCategory.ValidationError, detail);
  }
}

export class RequestDeniedProblem extends Problem {
  constructor(detail: string) {
    super("challenge-example/request-denied", ProblemCategory.Forbidden, detail);
  }
}
