import { Problem } from "@croco/problems-core";
import type { CreateEmailResponse } from "resend";
import {
  ResendIdempotencyConflictProblem,
  ResendRetryableUpstreamProblem,
  ResendTerminalUpstreamProblem,
  ResendValidationProblem,
  type ResendErrorContext,
  type ResendProblemOperation,
} from "./problems/ResendNotificationProblem";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_NAMES = new Set([
  "application_error",
  "concurrent_idempotent_requests",
  "internal_server_error",
  "rate_limit_exceeded",
]);
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const RESEND_ERROR_STATUS_BY_NAME: Record<string, number> = {
  application_error: 500,
  concurrent_idempotent_requests: 409,
  internal_server_error: 500,
  invalid_api_key: 403,
  invalid_api_Key: 403,
  invalid_idempotent_request: 409,
  invalid_parameter: 400,
  invalid_region: 422,
  invalid_smtp_configuration: 422,
  not_found: 404,
  rate_limit_exceeded: 429,
};

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|password|secret|token|api[-_]?key|access[-_]?key|access[-_]?token|idempotency[-_]?key)/i;

export type ResendError = Error & {
  code?: string;
  providerResponse?: CreateEmailResponse;
  retryAfter?: string;
  status?: number;
};

export type ResendProblemNormalizationOptions = {
  readonly redactionValues?: readonly string[];
};

export function normalizeResendError(
  error: unknown,
  fallbackMessage: string,
  providerResponse?: CreateEmailResponse,
): ResendError {
  if (error instanceof Error) {
    const resendError = error as ResendError;

    if (resendError.code && resendError.status === undefined) {
      resendError.status = RESEND_ERROR_STATUS_BY_NAME[resendError.code];
    }

    if (providerResponse) {
      resendError.providerResponse = providerResponse;
    }

    return resendError;
  }

  const errorRecord = asRecord(error);
  const message = typeof errorRecord?.message === "string" ? errorRecord.message : fallbackMessage;
  const resendError = new Error(message) as ResendError;

  if (typeof errorRecord?.name === "string") {
    resendError.code = errorRecord.name;
  } else if (typeof errorRecord?.code === "string") {
    resendError.code = errorRecord.code;
  }

  if (typeof errorRecord?.statusCode === "number") {
    resendError.status = errorRecord.statusCode;
  } else if (typeof errorRecord?.status === "number") {
    resendError.status = errorRecord.status;
  } else if (typeof errorRecord?.name === "string") {
    resendError.status = RESEND_ERROR_STATUS_BY_NAME[errorRecord.name];
  } else if (typeof errorRecord?.code === "string") {
    resendError.status = RESEND_ERROR_STATUS_BY_NAME[errorRecord.code];
  }

  if (typeof errorRecord?.retryAfter === "string") {
    resendError.retryAfter = errorRecord.retryAfter;
  }

  if (providerResponse) {
    resendError.providerResponse = providerResponse;
  }

  return resendError;
}

export function normalizeResendProblem(
  error: unknown,
  operation: ResendProblemOperation,
  providerResponse?: CreateEmailResponse,
  options: ResendProblemNormalizationOptions = {},
): Problem {
  if (error instanceof Problem) {
    return error;
  }

  const normalized = normalizeResendError(error, "Unknown Resend error", providerResponse);
  const context = createResendErrorContext(normalized, operation);
  const detail = sanitizeResendDiagnosticText(normalized.message, options.redactionValues);

  if (context.upstreamCode === "invalid_idempotent_request") {
    return new ResendIdempotencyConflictProblem(context, detail);
  }

  if (isValidationError(context)) {
    return new ResendValidationProblem(context, detail);
  }

  if (isRetryableResendError(normalized)) {
    return new ResendRetryableUpstreamProblem(context, detail);
  }

  return new ResendTerminalUpstreamProblem(context, detail);
}

export function createResendErrorContext(
  error: unknown,
  operation: ResendProblemOperation,
): ResendErrorContext {
  const normalized = normalizeResendError(error, "Unknown Resend error");
  const status = getErrorStatus(normalized);
  const upstreamCode = getErrorCode(normalized);
  const retryable = isRetryableResendError(normalized);

  return {
    provider: "resend",
    operation,
    retryable,
    ...(status === undefined ? {} : { status }),
    ...(upstreamCode === undefined ? {} : { upstreamCode }),
  };
}

export function isRetryableResendError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code !== undefined && TRANSIENT_ERROR_NAMES.has(code)) {
    return true;
  }

  const status = getErrorStatus(error);
  if (status !== undefined && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true;
  }

  if (code === undefined) {
    return false;
  }

  return TRANSIENT_ERROR_CODES.has(code);
}

export function sanitizeResendDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeResendDiagnosticValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
    };
  }

  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = SENSITIVE_DIAGNOSTIC_KEY.test(key)
        ? "[redacted]"
        : sanitizeResendDiagnosticValue(nestedValue);
    }
    return sanitized;
  }

  if (typeof value === "string") {
    return sanitizeResendDiagnosticText(value);
  }

  return value;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return (error as ResendError).status;
}

function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return (error as ResendError).code;
}

function isValidationError(context: ResendErrorContext): boolean {
  return (
    context.status === 400 ||
    context.status === 422 ||
    context.upstreamCode === "invalid_parameter" ||
    context.upstreamCode === "invalid_region" ||
    context.upstreamCode === "invalid_smtp_configuration"
  );
}

export function sanitizeResendDiagnosticText(
  value: string,
  redactionValues: readonly string[] = [],
): string {
  const sensitiveValueRedacted = getUniqueRedactionValues(redactionValues).reduce(
    (current, sensitiveValue) =>
      current.replace(new RegExp(escapeRegExp(sensitiveValue), "g"), "[redacted]"),
    value,
  );

  return sensitiveValueRedacted
    .replace(
      /(authorization|password|secret|token|api[-_]?key|access[-_]?key|idempotency[-_]?key)=([^\s]+)/gi,
      "$1=[redacted]",
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]")
    .replace(/re_[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function getUniqueRedactionValues(values: readonly string[]): readonly string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length >= 4)),
  ].sort((left, right) => right.length - left.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
