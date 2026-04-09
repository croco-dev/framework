import { Problem } from '../Problem';
import { ProblemCategory } from '../ProblemCategory';

export class InvalidExtensionsProblem extends Problem {
  readonly code = 'problems-core/invalid-extensions';
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, 'Extensions must be an object');
  }
}
