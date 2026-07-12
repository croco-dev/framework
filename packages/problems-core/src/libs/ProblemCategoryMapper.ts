import { ProblemCategory } from "./ProblemCategory";

type Constructor<T = unknown, Args extends unknown[] = never[]> = new (...args: Args) => T;
type ProblemConstructorArgs = [code?: string, category?: ProblemCategory, detail?: string];

type ProblemModule = {
  Problem: Constructor<Error, ProblemConstructorArgs>;
};

declare const require: (id: string) => ProblemModule;

function throwUnhandledCategory(categoryValue: string): never {
  // Use runtime require to avoid circular dependency:
  // Problem.ts imports ProblemCategoryMapper, so any module-level
  // import of Problem here creates a module cycle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Problem: ProblemClass } = require("./Problem");
  class UnhandledCategoryProblem extends ProblemClass {
    readonly code = "problems-core/unhandled-category";
    readonly category = ProblemCategory.InternalServerError;
    constructor(v: string) {
      super(undefined, undefined, `Unhandled ProblemCategory: ${v}`);
    }
  }
  throw new UnhandledCategoryProblem(categoryValue);
}

export function toHttpStatus(category: ProblemCategory): number {
  switch (category) {
    case ProblemCategory.BadRequest:
      return 400;
    case ProblemCategory.Unauthorized:
      return 401;
    case ProblemCategory.Forbidden:
      return 403;
    case ProblemCategory.NotFound:
      return 404;
    case ProblemCategory.Conflict:
      return 409;
    case ProblemCategory.Gone:
      return 410;
    case ProblemCategory.PayloadTooLarge:
      return 413;
    case ProblemCategory.ValidationError:
      return 422;
    case ProblemCategory.BusinessRuleViolation:
      return 422;
    case ProblemCategory.TooManyRequests:
      return 429;
    case ProblemCategory.InternalServerError:
      return 500;
    case ProblemCategory.NotImplemented:
      return 501;
    default: {
      const _exhaustiveCheck: never = category;
      throwUnhandledCategory(String(_exhaustiveCheck));
    }
  }
}

export function toTitle(category: ProblemCategory): string {
  switch (category) {
    case ProblemCategory.BadRequest:
      return "Bad Request";
    case ProblemCategory.Unauthorized:
      return "Unauthorized";
    case ProblemCategory.Forbidden:
      return "Forbidden";
    case ProblemCategory.NotFound:
      return "Not Found";
    case ProblemCategory.Conflict:
      return "Conflict";
    case ProblemCategory.Gone:
      return "Gone";
    case ProblemCategory.PayloadTooLarge:
      return "Payload Too Large";
    case ProblemCategory.ValidationError:
      return "Validation Error";
    case ProblemCategory.BusinessRuleViolation:
      return "Business Rule Violation";
    case ProblemCategory.TooManyRequests:
      return "Too Many Requests";
    case ProblemCategory.InternalServerError:
      return "Internal Server Error";
    case ProblemCategory.NotImplemented:
      return "Not Implemented";
    default: {
      const _exhaustiveCheck: never = category;
      throwUnhandledCategory(String(_exhaustiveCheck));
    }
  }
}

export const ProblemCategoryMapper = {
  toHttpStatus,
  toTitle,
};
