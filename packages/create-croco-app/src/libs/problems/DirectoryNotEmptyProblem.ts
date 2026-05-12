import { Problem, ProblemCategory } from "@croco/problems-core";

export class DirectoryNotEmptyProblem extends Problem {
  readonly code = "create-croco-app/directory-not-empty";
  readonly category = ProblemCategory.ValidationError;

  constructor(directoryPath: string) {
    super(undefined, undefined, `Directory '${directoryPath}' is not empty.`);
  }
}
