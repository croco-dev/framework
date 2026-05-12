import { Problem, ProblemCategory } from "@croco/problems-core";

export class GraphQLValidationProblem extends Problem {
  constructor(code: string, detail: string, extensions?: Record<string, unknown>) {
    super(code, ProblemCategory.ValidationError, detail, { extensions });
  }
}

export class GraphQLAuthorizationProblem extends Problem {
  constructor(code: string, detail: string) {
    super(code, ProblemCategory.Forbidden, detail);
  }
}

export class GraphQLAuthenticationProblem extends Problem {
  constructor(code: string, detail: string) {
    super(code, ProblemCategory.Unauthorized, detail);
  }
}

export class GraphQLNotFoundProblem extends Problem {
  constructor(resource: string, id?: string) {
    super(
      "GRAPHQL_NOT_FOUND",
      ProblemCategory.NotFound,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
    );
  }
}

export class GraphQLInternalError extends Problem {
  constructor(code: string, detail: string, cause?: Error) {
    super(code, ProblemCategory.InternalServerError, detail, { cause });
  }
}
