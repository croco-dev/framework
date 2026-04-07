import { Problem, ProblemCategory } from '@croco/problems-core';

export type ValidationIssue = {
  path: string;
  message: string;
};

export class ValidationProblem extends Problem {
  readonly code = 'protocols-rest/validation-failed';
  readonly category = ProblemCategory.ValidationError;
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');

    super(undefined, undefined, detail, {
      extensions: { issues },
    });

    this.issues = issues;
  }
}

export class RequestValidationProblem extends Problem {
  readonly code = 'protocols-rest/request-validation-failed';
  readonly category = ProblemCategory.ValidationError;
  readonly issues: ValidationIssue[];

  constructor(source: 'body' | 'query' | 'params' | 'headers', issues: ValidationIssue[]) {
    const prefixedIssues = issues.map((issue) => ({
      path: `${source}.${issue.path}`,
      message: issue.message,
    }));
    const detail = prefixedIssues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');

    super(undefined, undefined, detail, {
      extensions: { issues: prefixedIssues },
    });

    this.issues = prefixedIssues;
  }
}

export class ResponseValidationProblem extends Problem {
  readonly code = 'protocols-rest/response-validation-failed';
  readonly category = ProblemCategory.InternalServerError;

  constructor(issues: ValidationIssue[]) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');

    super(undefined, undefined, detail, {
      extensions: { issues },
    });
  }
}
