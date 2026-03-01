import { z } from 'zod';

export function createEnv<T extends z.ZodRawShape>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<z.ZodObject<T>> {
  const result = z.object(schema).safeParse(env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
