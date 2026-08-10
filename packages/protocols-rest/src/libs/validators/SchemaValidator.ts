import type { z } from "zod";
import {
  RequestValidationProblem,
  ResponseValidationProblem,
  type ValidationIssue,
} from "./ValidationProblem";

/**
 * 요청 데이터를 Zod 스키마로 검증하고 실패 시 요청 검증 Problem을 발생시킵니다.
 */
export function validateRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
  source: "body" | "query" | "params" | "headers",
): z.output<TSchema> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "value",
      message: issue.message,
    }));

    throw new RequestValidationProblem(source, issues);
  }

  return result.data;
}

/**
 * 응답 데이터를 Zod 스키마로 검증하고 실패 시 응답 검증 Problem을 발생시킵니다.
 */
export function validateResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "value",
      message: issue.message,
    }));

    throw new ResponseValidationProblem(issues);
  }

  return result.data;
}

/**
 * 동기, 비동기, 안전 파싱 API를 가진 검증 유틸리티를 생성합니다.
 */
export function createValidator<TSchema extends z.ZodType>(schema: TSchema) {
  return {
    parse: (data: unknown): z.output<TSchema> => {
      const result = schema.safeParse(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join(".") || "value",
          message: issue.message,
        }));

        throw new RequestValidationProblem("body", issues);
      }

      return result.data;
    },

    parseAsync: async (data: unknown): Promise<z.output<TSchema>> => {
      const result = await schema.safeParseAsync(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join(".") || "value",
          message: issue.message,
        }));

        throw new RequestValidationProblem("body", issues);
      }

      return result.data;
    },

    safeParse: (
      data: unknown,
    ):
      | { success: true; data: z.output<TSchema> }
      | { success: false; error: ValidationIssue[] } => {
      const result = schema.safeParse(data);

      if (!result.success) {
        const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
          path: issue.path.join(".") || "value",
          message: issue.message,
        }));

        return { success: false, error: issues };
      }

      return { success: true, data: result.data };
    },
  };
}
