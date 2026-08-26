import { Problem, ProblemCategory } from "@croco/problems-core";

type OpenAiErrorMetadata = {
  readonly operation: string;
  readonly upstreamStatus?: number;
  readonly requestId?: string;
  readonly upstreamCode?: string;
};

type UnknownOpenAiError = {
  readonly name?: unknown;
  readonly message?: unknown;
  readonly status?: unknown;
  readonly code?: unknown;
  readonly request_id?: unknown;
  readonly requestID?: unknown;
  readonly headers?: unknown;
};

export class OpenAiMissingConfigProblem extends Problem {
  static readonly CODE = "llm-openai/missing-config";

  constructor(configKey: string) {
    super(
      OpenAiMissingConfigProblem.CODE,
      ProblemCategory.InternalServerError,
      `Missing required OpenAI configuration: ${configKey}`,
      {
        extensions: {
          configKey,
          provider: "openai",
        },
      },
    );
  }
}

export class OpenAiAuthenticationProblem extends Problem {
  static readonly CODE = "llm-openai/authentication-failed";

  constructor(metadata: OpenAiErrorMetadata) {
    super(
      OpenAiAuthenticationProblem.CODE,
      ProblemCategory.Unauthorized,
      `OpenAI authentication failed during ${metadata.operation}`,
      {
        extensions: toExtensions(metadata),
      },
    );
  }
}

export class OpenAiRateLimitProblem extends Problem {
  static readonly CODE = "llm-openai/rate-limited";

  constructor(metadata: OpenAiErrorMetadata & { readonly retryAfter?: number }) {
    super(
      OpenAiRateLimitProblem.CODE,
      ProblemCategory.TooManyRequests,
      `OpenAI rate limit exceeded during ${metadata.operation}`,
      {
        extensions: toExtensions(metadata),
      },
    );
  }
}

export class OpenAiRetryableUpstreamProblem extends Problem {
  static readonly CODE = "llm-openai/retryable-upstream";

  constructor(metadata: OpenAiErrorMetadata) {
    super(
      OpenAiRetryableUpstreamProblem.CODE,
      ProblemCategory.InternalServerError,
      `OpenAI returned a retryable upstream failure during ${metadata.operation}`,
      {
        extensions: toExtensions(metadata),
      },
    );
  }
}

export class OpenAiTerminalUpstreamProblem extends Problem {
  static readonly CODE = "llm-openai/terminal-upstream";

  constructor(metadata: OpenAiErrorMetadata) {
    super(
      OpenAiTerminalUpstreamProblem.CODE,
      ProblemCategory.InternalServerError,
      `OpenAI returned a terminal upstream failure during ${metadata.operation}`,
      {
        extensions: toExtensions(metadata),
      },
    );
  }
}

export class OpenAiValidationProblem extends Problem {
  static readonly CODE = "llm-openai/validation-failed";

  constructor(metadata: OpenAiErrorMetadata) {
    super(
      OpenAiValidationProblem.CODE,
      ProblemCategory.BadRequest,
      `OpenAI rejected the request during ${metadata.operation}`,
      {
        extensions: toExtensions(metadata),
      },
    );
  }
}

export class OpenAiAbortProblem extends Problem {
  static readonly CODE = "llm-openai/aborted";

  constructor(operation: string) {
    super(
      OpenAiAbortProblem.CODE,
      ProblemCategory.BadRequest,
      `OpenAI request aborted during ${operation}`,
      {
        extensions: {
          operation,
          provider: "openai",
        },
      },
    );
  }
}

export class OpenAiInvalidResponseProblem extends Problem {
  static readonly CODE = "llm-openai/invalid-response";

  constructor(operation: string, reason: string) {
    super(
      OpenAiInvalidResponseProblem.CODE,
      ProblemCategory.InternalServerError,
      `Invalid OpenAI response during ${operation}: ${reason}`,
      {
        extensions: {
          operation,
          provider: "openai",
          reason,
        },
      },
    );
  }
}

export function normalizeOpenAiError(error: unknown, operation: string): Problem {
  if (error instanceof Problem) {
    return error;
  }

  const candidate = isRecord(error) ? (error as UnknownOpenAiError) : {};
  const name = stringValue(candidate.name);

  if (name === "AbortError" || name === "APIUserAbortError") {
    return new OpenAiAbortProblem(operation);
  }

  const status = numberValue(candidate.status);
  const metadata: OpenAiErrorMetadata = {
    operation,
    ...(status !== undefined ? { upstreamStatus: status } : {}),
    ...requestIdExtension(candidate),
    ...upstreamCodeExtension(candidate),
  };

  if (status === 401 || status === 403) {
    return new OpenAiAuthenticationProblem(metadata);
  }

  if (status === 429) {
    return new OpenAiRateLimitProblem({
      ...metadata,
      ...retryAfterExtension(candidate),
    });
  }

  if (status === 400 || status === 422) {
    return new OpenAiValidationProblem(metadata);
  }

  if (status === undefined || status === 408 || status === 409 || status >= 500) {
    return new OpenAiRetryableUpstreamProblem(metadata);
  }

  return new OpenAiTerminalUpstreamProblem(metadata);
}

function toExtensions(
  metadata: OpenAiErrorMetadata & { readonly retryAfter?: number },
): Record<string, string | number> {
  return {
    operation: metadata.operation,
    provider: "openai",
    ...(metadata.upstreamStatus !== undefined ? { upstreamStatus: metadata.upstreamStatus } : {}),
    ...(metadata.requestId !== undefined ? { requestId: metadata.requestId } : {}),
    ...(metadata.upstreamCode !== undefined ? { upstreamCode: metadata.upstreamCode } : {}),
    ...(metadata.retryAfter !== undefined ? { retryAfter: metadata.retryAfter } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requestIdExtension(error: UnknownOpenAiError): Pick<OpenAiErrorMetadata, "requestId"> {
  const requestId = stringValue(error.request_id) ?? stringValue(error.requestID);
  return requestId ? { requestId } : {};
}

function upstreamCodeExtension(
  error: UnknownOpenAiError,
): Pick<OpenAiErrorMetadata, "upstreamCode"> {
  const upstreamCode = stringValue(error.code);
  return upstreamCode ? { upstreamCode } : {};
}

function retryAfterExtension(error: UnknownOpenAiError): { readonly retryAfter?: number } {
  if (!isHeaderContainer(error.headers)) {
    return {};
  }

  const retryAfter = error.headers.get("retry-after");
  const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
  return Number.isFinite(seconds) ? { retryAfter: seconds } : {};
}

function isHeaderContainer(value: unknown): value is { get(name: string): string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as { readonly get?: unknown }).get === "function"
  );
}
