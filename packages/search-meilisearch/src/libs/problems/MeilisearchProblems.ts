import { Problem, ProblemCategory } from "@croco/problems-core";

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "MeiliSearchRequestError",
  "MeiliSearchTimeOutError",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export type MeilisearchErrorContext = {
  readonly provider?: "meilisearch";
  readonly operation: string;
  readonly indexName?: string;
  readonly documentId?: string;
  readonly status?: number;
  readonly upstreamCode?: string;
  readonly retryable?: boolean;
};

type MeilisearchConfigKey = "host" | "apiKey" | "tenantTokenOptions.apiKeyUid";

/**
 * 필수 Meilisearch 설정이 누락되었을 때 발생하는 Problem입니다.
 */
export class MissingMeilisearchConfigProblem extends Problem {
  constructor(configKey: MeilisearchConfigKey, operation = "configuration") {
    super(
      "search-meilisearch/missing-config",
      ProblemCategory.InternalServerError,
      `Meilisearch configuration is missing required value '${configKey}'`,
      {
        extensions: {
          provider: "meilisearch",
          operation,
          configKey,
          retryable: false,
        },
      },
    );
  }
}

/**
 * Meilisearch 요청 검증에 실패했을 때 발생하는 Problem입니다.
 */
export class MeilisearchInvalidRequestProblem extends Problem {
  constructor(context: MeilisearchErrorContext, detail = "Meilisearch request validation failed") {
    super(
      "search-meilisearch/invalid-request",
      ProblemCategory.ValidationError,
      `${detail} during ${context.operation}`,
      {
        extensions: {
          ...toMeilisearchExtensions(context),
          retryable: false,
        },
      },
    );
  }
}

/**
 * 요청한 Meilisearch 인덱스를 찾을 수 없을 때 발생하는 Problem입니다.
 */
export class MeilisearchIndexNotFoundProblem extends Problem {
  constructor(context: MeilisearchErrorContext) {
    super(
      "search-meilisearch/index-not-found",
      ProblemCategory.NotFound,
      `Meilisearch index was not found during ${context.operation}`,
      {
        extensions: {
          ...toMeilisearchExtensions(context),
          retryable: false,
        },
      },
    );
  }
}

/**
 * 재시도 가능한 Meilisearch 업스트림 실패를 나타내는 Problem입니다.
 */
export class MeilisearchRetryableUpstreamProblem extends Problem {
  constructor(context: MeilisearchErrorContext, message: string) {
    super(
      "search-meilisearch/retryable-upstream",
      ProblemCategory.InternalServerError,
      `Meilisearch upstream request failed retryably during ${context.operation}: ${message}`,
      {
        extensions: {
          ...toMeilisearchExtensions(context),
          retryable: true,
        },
      },
    );
  }
}

/**
 * 재시도할 수 없는 Meilisearch 업스트림 실패를 나타내는 Problem입니다.
 */
export class MeilisearchTerminalUpstreamProblem extends Problem {
  constructor(context: MeilisearchErrorContext, message: string) {
    super(
      "search-meilisearch/terminal-upstream",
      ProblemCategory.InternalServerError,
      `Meilisearch upstream request failed terminally during ${context.operation}: ${message}`,
      {
        extensions: {
          ...toMeilisearchExtensions(context),
          retryable: false,
        },
      },
    );
  }
}

/**
 * 테넌트 토큰 옵션 없이 토큰 발급을 시도할 때 발생하는 문제입니다.
 */
export class TenantTokenNotConfiguredProblem extends Problem {
  constructor() {
    super(
      "search-meilisearch/tenant-token-not-configured",
      ProblemCategory.InternalServerError,
      "Tenant token options are not configured",
      {
        extensions: {
          provider: "meilisearch",
          operation: "generateTenantToken",
          retryable: false,
        },
      },
    );
  }
}

/**
 * Meilisearch 오류를 표준화된 Problem 인스턴스로 변환합니다.
 */
export function normalizeMeilisearchError(
  error: unknown,
  context: MeilisearchErrorContext,
): Problem {
  if (error instanceof Problem) {
    return error;
  }

  const normalizedContext = createMeilisearchErrorContext(error, context);
  const safeMessage = redactSensitiveValue(getMeilisearchErrorMessage(error));

  if (isIndexNotFoundError(normalizedContext, error)) {
    return new MeilisearchIndexNotFoundProblem(normalizedContext);
  }

  if (isValidationError(normalizedContext)) {
    return new MeilisearchInvalidRequestProblem(normalizedContext, safeMessage);
  }

  if (isRetryableMeilisearchError(error, normalizedContext)) {
    return new MeilisearchRetryableUpstreamProblem(normalizedContext, safeMessage);
  }

  return new MeilisearchTerminalUpstreamProblem(normalizedContext, safeMessage);
}

/**
 * Meilisearch 오류가 재시도 가능한지 여부를 판별합니다.
 */
export function isRetryableMeilisearchError(
  error: unknown,
  knownContext?: MeilisearchErrorContext,
): boolean {
  const context = knownContext ?? createMeilisearchErrorContext(error, { operation: "unknown" });

  if (context.status !== undefined && RETRYABLE_HTTP_STATUSES.has(context.status)) {
    return true;
  }

  if (context.upstreamCode && RETRYABLE_ERROR_CODES.has(context.upstreamCode)) {
    return true;
  }

  const message = getMeilisearchErrorMessage(error).toLowerCase();

  return [
    "connection reset",
    "connect timeout",
    "econnreset",
    "fetch failed",
    "network error",
    "rate limit",
    "socket hang up",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "too many requests",
    "try again",
  ].some((pattern) => message.includes(pattern));
}

function createMeilisearchErrorContext(
  error: unknown,
  context: MeilisearchErrorContext,
): MeilisearchErrorContext {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const cause = asRecord(record?.cause);
  const nestedError = asRecord(record?.error);
  const status = firstNumber(
    context.status,
    record?.status,
    record?.statusCode,
    record?.httpStatus,
    response?.status,
    response?.statusCode,
    cause?.status,
    cause?.statusCode,
    nestedError?.status,
    nestedError?.statusCode,
  );
  const upstreamCode = firstString(
    context.upstreamCode,
    record?.code,
    record?.name,
    cause?.code,
    cause?.type,
    cause?.name,
    nestedError?.code,
    nestedError?.type,
    nestedError?.name,
  );

  return {
    provider: "meilisearch",
    operation: context.operation,
    ...(context.indexName !== undefined && { indexName: context.indexName }),
    ...(context.documentId !== undefined && { documentId: context.documentId }),
    ...(status !== undefined && { status }),
    ...(upstreamCode !== undefined && { upstreamCode }),
  };
}

function isIndexNotFoundError(context: MeilisearchErrorContext, error: unknown): boolean {
  const code = context.upstreamCode?.toLowerCase();

  return (
    context.status === 404 ||
    code === "index_not_found" ||
    getMeilisearchErrorMessage(error).toLowerCase().includes("index not found")
  );
}

function isValidationError(context: MeilisearchErrorContext): boolean {
  const code = context.upstreamCode?.toLowerCase() ?? "";

  if (context.status === 401 || context.status === 403) {
    return false;
  }

  return (
    context.status === 400 ||
    context.status === 422 ||
    (context.status === undefined && (code.startsWith("invalid_") || code.startsWith("missing_")))
  );
}

function toMeilisearchExtensions(context: MeilisearchErrorContext): Record<string, unknown> {
  return {
    provider: "meilisearch",
    operation: context.operation,
    ...(context.indexName !== undefined && { indexName: context.indexName }),
    ...(context.documentId !== undefined && { documentId: context.documentId }),
    ...(context.status !== undefined && { upstreamStatus: context.status }),
    ...(context.upstreamCode !== undefined && { upstreamCode: context.upstreamCode }),
    ...(context.retryable !== undefined && { retryable: context.retryable }),
  };
}

function getMeilisearchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  const record = asRecord(error);
  const message = record?.message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  const causeMessage = asRecord(record?.cause)?.message;
  if (typeof causeMessage === "string" && causeMessage.length > 0) {
    return causeMessage;
  }

  const nestedMessage = asRecord(record?.error)?.message;
  if (typeof nestedMessage === "string" && nestedMessage.length > 0) {
    return nestedMessage;
  }

  return "unknown upstream error";
}

function firstNumber(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function firstString(...values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

const SENSITIVE_KEY_PATTERN =
  "credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|connection[-_]?string|dsn";

function redactSensitiveValue(value: string): string {
  return value
    .replace(/\b(authorization)(\s*[:=]\s*)[^,\n;]+/gi, "$1$2[redacted]")
    .replace(/\b(cookie)(\s*[:=]\s*)[^,\n]+/gi, "$1$2[redacted]")
    .replace(
      new RegExp(
        `(["']?)(${SENSITIVE_KEY_PATTERN})\\1(\\s*[:=]\\s*)(["']?)([^"',\\s;&}]+)\\4`,
        "gi",
      ),
      "$1$2$1$3$4[redacted]$4",
    )
    .replace(new RegExp(`([?&](${SENSITIVE_KEY_PATTERN})=)[^&#\\s]+`, "gi"), "$1[redacted]");
}
