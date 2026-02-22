import { Problem, type ProblemOptions } from './Problem';
import { ProblemCategory } from './ProblemCategory';

class GenericProblem extends Problem {}

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
