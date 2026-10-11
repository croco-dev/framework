import { z } from "zod";
import { configDiagnostic } from "./libs/configDiagnostics";
import { ConfigValidationProblem } from "./libs/problems/ConfigProblems";

function isMissingAtPath(data: unknown, path: PropertyKey[]): boolean {
  let value = data;
  for (const key of path) {
    if (value === null || typeof value !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(value, key)) return true;
    value = Reflect.get(value, key);
    if (value === undefined) return true;
  }
  return false;
}

function objectFieldNames(schema: z.ZodType): string[] {
  if (schema instanceof z.ZodObject) return Object.keys(schema.shape);
  if (schema instanceof z.ZodLazy) {
    const inner = schema._zod.innerType;
    return inner instanceof z.ZodType ? objectFieldNames(inner) : [];
  }
  if (schema instanceof z.ZodPipe) {
    const inputFields = schema.in instanceof z.ZodType ? objectFieldNames(schema.in) : [];
    const outputFields = schema.out instanceof z.ZodType ? objectFieldNames(schema.out) : [];
    return [...new Set([...inputFields, ...outputFields])];
  }
  if ("unwrap" in schema && typeof schema.unwrap === "function") {
    const inner = schema.unwrap();
    if (inner instanceof z.ZodType) return objectFieldNames(inner);
  }
  return [];
}

function isRawInputIssue(
  schema: z.ZodType,
  path: PropertyKey[],
  origin: unknown,
  input: unknown,
): boolean {
  if (
    input === undefined &&
    (schema instanceof z.ZodOptional ||
      schema instanceof z.ZodDefault ||
      schema instanceof z.ZodPrefault ||
      schema instanceof z.ZodCatch)
  ) {
    return false;
  }
  if (path.length === 0 && schema === origin) return true;
  if (schema instanceof z.ZodPipe) {
    return schema.in instanceof z.ZodType && isRawInputIssue(schema.in, path, origin, input);
  }
  if (schema instanceof z.ZodIntersection) {
    return (
      (schema.def.left instanceof z.ZodType &&
        isRawInputIssue(schema.def.left, path, origin, input)) ||
      (schema.def.right instanceof z.ZodType &&
        isRawInputIssue(schema.def.right, path, origin, input))
    );
  }
  if (schema instanceof z.ZodLazy) {
    const inner = schema._zod.innerType;
    return inner instanceof z.ZodType && isRawInputIssue(inner, path, origin, input);
  }
  if ("unwrap" in schema && typeof schema.unwrap === "function") {
    const inner = schema.unwrap();
    if (inner instanceof z.ZodType) return isRawInputIssue(inner, path, origin, input);
  }
  if (schema instanceof z.ZodObject) {
    const field = path[0];
    if (typeof field !== "string") return false;
    const child = schema.shape[field];
    const childInput =
      input !== null && typeof input === "object" ? Reflect.get(input, field) : undefined;
    return child instanceof z.ZodType && isRawInputIssue(child, path.slice(1), origin, childInput);
  }
  return false;
}

function safeIssuePath(schema: z.ZodType, path: PropertyKey[]): string {
  const field = path[0];
  return typeof field === "string" && objectFieldNames(schema).includes(field) ? field : "<root>";
}

export function validateConfig<T>(
  schema: z.ZodType<T>,
  env?: Record<string, string | undefined>,
): T {
  const data = env ?? process.env;
  // safeParse removes issue.inst, which identifies the stage that rejected a value.
  const result = schema._zod.run({ value: data, issues: [] }, { async: false });
  if (result instanceof Promise) throw new z.core.$ZodAsyncError();

  if (result.issues.length > 0) {
    const diagnostics = result.issues.map((issue) => {
      const issuePath = issue.path ?? [];
      const path = safeIssuePath(schema, issuePath);
      const missing =
        issuePath.length > 0 &&
        (issue.code === "invalid_type" || issue.code === "invalid_value") &&
        isRawInputIssue(schema, issuePath, issue.inst, data) &&
        isMissingAtPath(data, issuePath);
      return configDiagnostic(path, issue, missing);
    });
    throw new ConfigValidationProblem(diagnostics);
  }

  return result.value as T;
}
