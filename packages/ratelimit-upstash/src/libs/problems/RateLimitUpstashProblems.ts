import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 저장소 타입과 정책 타입이 맞지 않을 때 발생하는 문제입니다.
 */
export class InvalidRateLimitPolicyProblem extends Problem {
  readonly code = "ratelimit-upstash/invalid-policy";
  readonly category = ProblemCategory.InternalServerError;

  constructor(storeType: string) {
    super(undefined, undefined, `Invalid policy for ${storeType} store`, {
      extensions: {
        retryable: false,
        storeType,
      },
    });
  }
}

export class MissingUpstashRateLimitConfigProblem extends Problem {
  readonly code = "ratelimit-upstash/missing-config";
  readonly category = ProblemCategory.InternalServerError;

  constructor(configKey: string) {
    super(undefined, undefined, `Missing required Upstash rate-limit configuration: ${configKey}`, {
      extensions: {
        configKey,
        retryable: false,
      },
    });
  }
}

export class UpstashRateLimitUpstreamProblem extends Problem {
  readonly code = "ratelimit-upstash/upstream-failed";

  constructor(operation: string, error: unknown) {
    const status = getUpstreamStatus(error);
    const retryable = isRetryableUpstashRateLimitError(error);
    const message = redactSensitiveValue(getErrorMessage(error));

    super(
      "ratelimit-upstash/upstream-failed",
      mapUpstreamProblemCategory(status, retryable),
      `Upstash Redis ${operation} failed: ${message}`,
      {
        extensions: {
          operation,
          provider: "upstash-redis",
          retryable,
          ...(status !== undefined ? { upstreamStatus: status } : {}),
        },
      },
    );
  }
}

export function isRetryableUpstashRateLimitError(error: unknown): boolean {
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

function mapUpstreamProblemCategory(
  status: number | undefined,
  retryable: boolean,
): ProblemCategory {
  if (status === 429) {
    return ProblemCategory.TooManyRequests;
  }

  if (status !== undefined && status >= 400 && status < 500 && !retryable) {
    return ProblemCategory.BadRequest;
  }

  return ProblemCategory.InternalServerError;
}

const SENSITIVE_KEY_PATTERN =
  "credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|connection[-_]?string|redis[-_]?url|dsn";

function redactSensitiveValue(value: string): string {
  return value
    .replace(/\b(authorization)(\s*[:=]\s*)[^,\n;]+/gi, "$1$2[Redacted]")
    .replace(/\b(cookie)(\s*[:=]\s*)[^,\n]+/gi, "$1$2[Redacted]")
    .replace(
      new RegExp(
        `(["']?)(${SENSITIVE_KEY_PATTERN})\\1(\\s*[:=]\\s*)(["']?)([^"',\\s;&}]+)\\4`,
        "gi",
      ),
      "$1$2$1$3$4[Redacted]$4",
    )
    .replace(new RegExp(`([?&](${SENSITIVE_KEY_PATTERN})=)[^&#\\s]+`, "gi"), "$1[Redacted]");
}
