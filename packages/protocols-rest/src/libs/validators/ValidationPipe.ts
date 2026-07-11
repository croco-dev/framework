import {
  getZodArrayInputSchema,
  isZodArraySchema,
  unwrapZodParameterSchema,
} from "@croco/protocols-core";
import type { z } from "zod";
import type { ArgumentMetadata, PipeTransform } from "../interfaces/PipeTransform";
import { RequestValidationProblem } from "./ValidationProblem";

/**
 * 파라미터 값을 Zod 스키마로 검증하는 기본 Pipe 구현체입니다.
 */
export class ValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const repeatedQuerySchema =
      metadata.type === "query" && Array.isArray(value)
        ? getZodArrayInputSchema(this.schema)
        : undefined;

    if (metadata.type === "query" && Array.isArray(value) && !repeatedQuerySchema) {
      throwRepeatedQueryValueProblem();
    }

    const schemaWithoutCatch = (repeatedQuerySchema ??
      unwrapZodParameterSchema(this.schema)) as z.ZodType<T>;
    const normalizedValue = normalizeHttpParameterValue(value, metadata, this.schema);

    const shouldParseWithoutCatch =
      schemaWithoutCatch !== this.schema &&
      ((metadata.type === "query" && Array.isArray(value)) ||
        (metadata.type === "header" && value !== undefined && isZodArraySchema(this.schema)));

    if (shouldParseWithoutCatch) {
      const result = schemaWithoutCatch.safeParse(normalizedValue);

      if (result.success) {
        return result.data;
      }

      throwValidationProblem(result.error.issues, metadata);
    }

    const result = this.schema.safeParse(normalizedValue);

    if (!result.success) {
      throwValidationProblem(result.error.issues, metadata);
    }

    return result.data;
  }
}

function throwRepeatedQueryValueProblem(): never {
  throw new RequestValidationProblem("query", [
    { path: "value", message: "Expected a single query value" },
  ]);
}

function throwValidationProblem(issues: readonly z.ZodIssue[], metadata: ArgumentMetadata): never {
  throw new RequestValidationProblem(
    mapMetadataTypeToSource(metadata.type),
    issues.map((issue) => ({
      path: issue.path.join(".") || "value",
      message: issue.message,
    })),
  );
}

function mapMetadataTypeToSource(
  type: ArgumentMetadata["type"],
): "body" | "query" | "params" | "headers" {
  switch (type) {
    case "body":
      return "body";
    case "query":
      return "query";
    case "param":
      return "params";
    case "header":
      return "headers";
    default:
      return "body";
  }
}

function normalizeHttpParameterValue(
  value: unknown,
  metadata: ArgumentMetadata,
  schema: z.ZodType,
): unknown {
  if (!isZodArraySchema(schema)) {
    return value;
  }

  if (metadata.type === "query" && typeof value === "string") {
    return [value];
  }

  if (metadata.type === "header") {
    return normalizeHeaderArrayValue(value);
  }

  return value;
}

function normalizeHeaderArrayValue(value: unknown): unknown {
  if (typeof value === "string") {
    return splitHeaderValues(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === "string" ? splitHeaderValues(item) : [item]));
  }

  return value;
}

function splitHeaderValues(value: string): string[] {
  return value.split(",").map((item) => item.trim());
}

/**
 * Zod 스키마 기반 ValidationPipe 인스턴스를 생성합니다.
 */
export function createValidationPipe<T>(schema: z.ZodType<T>): ValidationPipe<T> {
  return new ValidationPipe(schema);
}
