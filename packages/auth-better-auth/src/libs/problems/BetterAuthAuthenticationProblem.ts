import { Problem, ProblemCategory } from "@croco/problems-core";
import { redactSensitiveValue } from "../redaction";

/**
 * Better Auth 작업 중 예기치 않은 upstream 오류가 발생했을 때 발생하는 문제입니다.
 */
export class BetterAuthAuthenticationProblem extends Problem {
  readonly code = "auth-better-auth/authentication-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    operation: "authenticate" | "readiness" | "revokeSession" | "revokeUserSessions",
    error: unknown,
  ) {
    const status = getUpstreamStatus(error);
    const retryable = isRetryableBetterAuthError(error);
    const message =
      operation === "revokeSession" || operation === "revokeUserSessions"
        ? "upstream revocation failed"
        : redactSensitiveValue(getErrorMessage(error), "[Redacted]");

    super(undefined, undefined, `Better Auth ${operation} failed: ${message}`, {
      extensions: {
        operation,
        provider: "better-auth",
        retryable,
        ...(status !== undefined ? { upstreamStatus: status } : {}),
      },
    });
  }
}

export function isRetryableBetterAuthError(error: unknown): boolean {
  const status = getUpstreamStatus(error);
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  const record = asRecord(error);
  if (typeof record?.message === "string" && record.message) {
    return record.message;
  }

  return "unknown upstream error";
}

function getUpstreamStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  const directStatus = normalizeStatus(record?.status ?? record?.statusCode);
  if (directStatus !== undefined) {
    return directStatus;
  }

  const response = asRecord(record?.response);
  return normalizeStatus(response?.status ?? response?.statusCode);
}

function normalizeStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const status = Number(value);
    return Number.isInteger(status) ? status : undefined;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
