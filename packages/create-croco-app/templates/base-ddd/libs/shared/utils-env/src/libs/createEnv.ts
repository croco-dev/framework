import { z } from 'zod';

export function createEnv<T extends z.ZodRawShape>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<z.ZodObject<T>> {
  const result = z.object(schema).safeParse(env);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
