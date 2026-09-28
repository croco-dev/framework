import { Problem, ProblemCategory } from "@croco/problems-core";

export class EtlEventProblem extends Problem {
  readonly code: string;
  readonly category = ProblemCategory.InternalServerError;

  constructor(code: string) {
    super(code, ProblemCategory.InternalServerError, code);
    this.code = code;
  }
}
