import type { ProblemCategory } from './ProblemCategory';

export abstract class Problem extends Error {
  public readonly code: string;
  public readonly category: ProblemCategory;
  public readonly detail?: string;

  protected constructor(code: string, category: ProblemCategory, detail?: string) {
    super(detail ?? code);

    this.code = code;
    this.category = category;
    this.detail = detail;
    this.name = new.target.name;

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}
