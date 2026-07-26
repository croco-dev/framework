import { Problem, ProblemCategory } from "@croco/problems-core";

export type DesktopDefinitionProblemCode =
  | "DESKTOP_AMBIGUOUS_MEMBER_REFERENCE"
  | "DESKTOP_INVALID_KEY"
  | "DESKTOP_UNMOUNTED_MEMBER_REFERENCE";

export class DesktopDefinitionProblem extends Problem {
  public constructor(code: DesktopDefinitionProblemCode, detail: string) {
    super(code, ProblemCategory.ValidationError, detail);
  }
}
