import { Problem, type ProblemOptions } from './Problem';
import { ProblemCategory } from './ProblemCategory';

class GenericProblem extends Problem {
  // biome-ignore lint/complexity/noUselessConstructor: Problem's constructor is protected, so subclass needs explicit constructor
  constructor(code: string, category: ProblemCategory, detail?: string, options?: ProblemOptions) {
    super(code, category, detail, options);
  }
}

export const ProblemFactory = {
  badRequest(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.BadRequest, detail, options);
  },
  unauthorized(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Unauthorized, detail, options);
  },
  forbidden(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Forbidden, detail, options);
  },
  notFound(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.NotFound, detail, options);
  },
  conflict(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Conflict, detail, options);
  },
  gone(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.Gone, detail, options);
  },
  validationError(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.ValidationError, detail, options);
  },
  businessRuleViolation(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.BusinessRuleViolation, detail, options);
  },
  tooManyRequests(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.TooManyRequests, detail, options);
  },
  internalServerError(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.InternalServerError, detail, options);
  },
  notImplemented(code: string, detail?: string, options?: ProblemOptions): Problem {
    return new GenericProblem(code, ProblemCategory.NotImplemented, detail, options);
  },
};
