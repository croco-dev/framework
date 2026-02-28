import type { z } from 'zod';
import { ConfigValidationProblem } from './libs/problems/ConfigProblems';

export function validateConfig<T>(schema: z.ZodType<T>, env?: Record<string, string | undefined>): T {
  const data = env ?? process.env;
  const result = schema.safeParse(data);

  if (!result.success) {
    const missingPaths = result.error.issues.map((issue) => issue.path.join('.'));
    const missing = missingPaths.join(', ');
    console.error(`[CONFIG ERROR] Missing required: ${missing}`);
    throw new ConfigValidationProblem(missingPaths);
  }

  return result.data;
}
