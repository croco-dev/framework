import { z } from "zod";
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
  if (schema instanceof z.ZodPipe) {
    const inputFields = schema.in instanceof z.ZodType ? objectFieldNames(schema.in) : [];
    return inputFields.length > 0
      ? inputFields
      : schema.out instanceof z.ZodType
        ? objectFieldNames(schema.out)
        : [];
  }
  if ("unwrap" in schema && typeof schema.unwrap === "function") {
    const inner = schema.unwrap();
    if (inner instanceof z.ZodType) return objectFieldNames(inner);
  }
  return [];
}

function safeIssuePath(schema: z.ZodType, path: PropertyKey[]): string {
  const field = path[0];
  return typeof field === "string" && objectFieldNames(schema).includes(field) ? field : "<root>";
}

function safeIssueMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return /^(string|number|boolean|object|array|null|undefined|bigint|date|symbol|function)$/.test(
        issue.expected,
      )
        ? `Expected ${issue.expected}`
        : "Invalid type";
    case "invalid_format":
      return issue.format === "url" ? "Invalid URL" : "Invalid format";
    case "invalid_value":
      return "Invalid option";
    case "too_small":
      return "Value is too small";
    case "too_big":
      return "Value is too large";
    default:
      return "Invalid value";
  }
}

export function validateConfig<T>(
  schema: z.ZodType<T>,
  env?: Record<string, string | undefined>,
): T {
  const data = env ?? process.env;
  const result = schema.safeParse(data);

  if (!result.success) {
    const diagnostics = result.error.issues.map((issue) => {
      const path = safeIssuePath(schema, issue.path);
      if (issue.path.length > 0 && isMissingAtPath(data, issue.path)) {
        return `${path}: Missing required`;
      }
      return `${path}: ${issue.code}: ${safeIssueMessage(issue)}`;
    });
    throw new ConfigValidationProblem(diagnostics);
  }

  return result.data;
}
