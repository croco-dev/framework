import type { z } from "zod";

/** Zod validation error with field-level details */
export class ValidationError {
  readonly code = "VALIDATION_ERROR";
  constructor(public fields: Record<string, string[]>) {}
}

/**
 * Validate data against a Zod schema.
 * Returns typed success/error without throwing.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const flat = result.error.flatten().fieldErrors;
  const entries: Array<[string, string[]]> = Object.entries(flat).map(([k, v]) => [
    k,
    (v ?? []) as string[],
  ]);
  const fields: Record<string, string[]> = Object.fromEntries(entries);
  return { success: false, error: new ValidationError(fields) };
}
