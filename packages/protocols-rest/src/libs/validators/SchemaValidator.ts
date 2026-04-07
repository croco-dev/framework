import type { z } from 'zod';
import { RequestValidationProblem, ResponseValidationProblem, type ValidationIssue } from './ValidationProblem';

export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown,
  source: 'body' | 'query' | 'params' | 'headers'
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'value',
      message: issue.message,
    }));

    throw new RequestValidationProblem(source, issues);
  }

  return result.data;
}

export function validateResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'value',
      message: issue.message,
    }));

    throw new ResponseValidationProblem(issues);
  }

  return result.data;
}

export function createValidator<T>(schema: z.ZodType<T>) {
  return {
    parse: (data: unknown): T => {
      const result = schema.safeParse(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join('.') || 'value',
          message: issue.message,
        }));

        throw new RequestValidationProblem('body', issues);
      }

      return result.data;
    },

    parseAsync: async (data: unknown): Promise<T> => {
      const result = await schema.safeParseAsync(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join('.') || 'value',
          message: issue.message,
        }));

        throw new RequestValidationProblem('body', issues);
      }

      return result.data;
    },

    safeParse: (data: unknown): { success: true; data: T } | { success: false; error: ValidationIssue[] } => {
      const result = schema.safeParse(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join('.') || 'value',
          message: issue.message,
        }));

        return { success: false, error: issues };
      }

      return { success: true, data: result.data };
    },
  };
}
