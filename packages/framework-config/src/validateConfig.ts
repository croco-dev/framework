import type { z } from 'zod';

/**
 * Validates environment variables against a Zod schema.
 * On validation failure, logs missing required variables and exits with code 1.
 *
 * @param schema - Zod schema to validate against
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated and typed configuration object
 */
export function validateConfig<T>(schema: z.ZodType<T>, env?: Record<string, string | undefined>): T {
  const data = env ?? process.env;
  const result = schema.safeParse(data);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    console.error(`[CONFIG ERROR] Missing required: ${missing}`);
    process.exit(1);
  }

  return result.data;
}
