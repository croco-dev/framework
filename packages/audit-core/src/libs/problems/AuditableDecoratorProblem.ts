import { Problem, ProblemCategory } from '@croco/problems-core';

export class AuditableDecoratorProblem extends Problem {
  readonly code = 'audit-core/auditable-decorator-misuse';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
