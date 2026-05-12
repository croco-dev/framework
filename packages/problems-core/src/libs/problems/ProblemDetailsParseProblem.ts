import { Problem } from "../Problem";
import { ProblemCategory } from "../ProblemCategory";

export class ProblemDetailsParseProblem extends Problem {
  readonly code = "problems-core/parse-error";
  readonly category = ProblemCategory.BadRequest;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
