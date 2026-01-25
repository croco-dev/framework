import { ProblemCategory } from './ProblemCategory';

const HTTP_STATUS_MAP: Record<ProblemCategory, number> = {
  [ProblemCategory.BadRequest]: 400,
  [ProblemCategory.Unauthorized]: 401,
  [ProblemCategory.Forbidden]: 403,
  [ProblemCategory.NotFound]: 404,
  [ProblemCategory.Conflict]: 409,
  [ProblemCategory.Gone]: 410,
  [ProblemCategory.ValidationError]: 422,
  [ProblemCategory.BusinessRuleViolation]: 422,
  [ProblemCategory.TooManyRequests]: 429,
  [ProblemCategory.InternalServerError]: 500,
  [ProblemCategory.NotImplemented]: 501,
};

const TITLE_MAP: Record<ProblemCategory, string> = {
  [ProblemCategory.BadRequest]: 'Bad Request',
  [ProblemCategory.Unauthorized]: 'Unauthorized',
  [ProblemCategory.Forbidden]: 'Forbidden',
  [ProblemCategory.NotFound]: 'Not Found',
  [ProblemCategory.Conflict]: 'Conflict',
  [ProblemCategory.Gone]: 'Gone',
  [ProblemCategory.ValidationError]: 'Validation Error',
  [ProblemCategory.BusinessRuleViolation]: 'Business Rule Violation',
  [ProblemCategory.TooManyRequests]: 'Too Many Requests',
  [ProblemCategory.InternalServerError]: 'Internal Server Error',
  [ProblemCategory.NotImplemented]: 'Not Implemented',
};

export const ProblemCategoryMapper = {
  toHttpStatus(category: ProblemCategory): number {
    return HTTP_STATUS_MAP[category];
  },
  toTitle(category: ProblemCategory): string {
    return TITLE_MAP[category];
  },
};
