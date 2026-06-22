import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CloudflareImagesOptions } from "./types";

export type CloudflareImagesErrorContext = {
  readonly provider: "cloudflare-images";
  readonly operation: string;
  readonly key?: string;
  readonly status?: number;
  readonly upstreamCode?: string;
  readonly retryable?: boolean;
};

export type CloudflareImagesReadinessCheckContext = {
  readonly config: CloudflareImagesOptions;
  readonly signal?: AbortSignal;
};

export type CloudflareImagesReadinessCheckResult = {
  readonly message?: string;
  readonly details?: Record<string, unknown>;
};

export type CloudflareImagesDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: CloudflareImagesReadinessCheckContext,
  ) => Promise<CloudflareImagesReadinessCheckResult | void>;
};

export type CloudflareImagesConfigKey = "accountHash" | "accountId" | "apiToken";

/**
 * Problem raised when Cloudflare Images storage is used without a required configuration value.
 */
export class CloudflareImagesMissingConfigProblem extends Problem {
  constructor(configKey: CloudflareImagesConfigKey, operation = "configuration") {
    super(
      "storage-cloudflare/missing-config",
      ProblemCategory.InternalServerError,
      `Cloudflare Images configuration is missing required value '${configKey}'`,
      {
        extensions: {
          provider: "cloudflare-images",
          operation,
          configKey,
        },
      },
    );
  }
}

export class CloudflareImagesValidationProblem extends Problem {
  constructor(
    context: CloudflareImagesErrorContext,
    detail = "Cloudflare Images request validation failed",
  ) {
    super(
      "storage-cloudflare/validation-failed",
      ProblemCategory.ValidationError,
      `${detail} during ${context.operation}`,
      {
        extensions: context,
      },
    );
  }
}

export class CloudflareImagesRetryableUpstreamProblem extends Problem {
  constructor(context: CloudflareImagesErrorContext) {
    super(
      "storage-cloudflare/retryable-upstream",
      ProblemCategory.InternalServerError,
      `Cloudflare Images upstream request failed retryably during ${context.operation}`,
      {
        extensions: {
          ...context,
          retryable: true,
        },
      },
    );
  }
}

export class CloudflareImagesTerminalUpstreamProblem extends Problem {
  constructor(context: CloudflareImagesErrorContext) {
    super(
      "storage-cloudflare/terminal-upstream",
      ProblemCategory.InternalServerError,
      `Cloudflare Images upstream request failed terminally during ${context.operation}`,
      {
        extensions: {
          ...context,
          retryable: false,
        },
      },
    );
  }
}

export class CloudflareImagesDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "storage-cloudflare";

  constructor(
    private readonly config: Partial<CloudflareImagesOptions>,
    private readonly options: CloudflareImagesDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = this.createSafeConfigDetails();
    let validConfig: CloudflareImagesOptions;

    try {
      validConfig = validateCloudflareImagesOptions(this.config);
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : normalizeCloudflareImagesError(error, { operation: "configuration" });

      return {
        status: "unhealthy",
        component: this.name,
        message: problem.detail,
        details: {
          ...baseDetails,
          liveCheck: "not_started",
          problemCode: problem.code,
          problemStatus: problem.status,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    if (!this.options.readinessCheck) {
      return {
        status: "healthy",
        component: this.name,
        message:
          "Cloudflare Images configuration is present; live upstream readiness check is not configured",
        details: {
          ...baseDetails,
          liveCheck: "not_configured",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      const result = await this.options.readinessCheck({ config: validConfig, signal });

      return {
        status: "healthy",
        component: this.name,
        message: result?.message ?? "Cloudflare Images readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = normalizeCloudflareImagesError(error, { operation: "readiness" });

      return {
        status: "degraded",
        component: this.name,
        message: problem.detail,
        details: {
          ...baseDetails,
          liveCheck: "failed",
          problemCode: problem.code,
          problemStatus: problem.status,
        },
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private createSafeConfigDetails(): Record<string, unknown> {
    return {
      provider: "cloudflare-images",
      hasAccountId: isNonEmptyString(this.config.accountId),
      hasApiToken: isNonEmptyString(this.config.apiToken),
      hasAccountHash: isNonEmptyString(this.config.accountHash),
      hasSigningKey: isNonEmptyString(this.config.signingKey),
      hasCustomDomain: isNonEmptyString(this.config.customDomain),
      defaultVariant: this.config.defaultVariant ?? "public",
      metadataSupport: {
        contentType: "unsupported",
        customMetadata: "unsupported",
      },
    };
  }
}

export function validateCloudflareImagesOptions(
  config: Partial<CloudflareImagesOptions>,
): CloudflareImagesOptions {
  if (!isNonEmptyString(config.accountId)) {
    throw new CloudflareImagesMissingConfigProblem("accountId");
  }

  if (!isNonEmptyString(config.apiToken)) {
    throw new CloudflareImagesMissingConfigProblem("apiToken");
  }

  if (!isNonEmptyString(config.accountHash)) {
    throw new CloudflareImagesMissingConfigProblem("accountHash");
  }

  validatePositiveInteger(config.ttl, "ttl");
  validatePositiveInteger(config.maxUploadBytes, "maxUploadBytes");

  return config as CloudflareImagesOptions;
}

export function normalizeCloudflareImagesError(
  error: unknown,
  options: {
    readonly operation: string;
    readonly key?: string;
    readonly status?: number;
    readonly upstreamCode?: string;
  },
): Problem {
  if (error instanceof Problem) {
    return error;
  }

  const context = createCloudflareImagesErrorContext(error, options);

  if (isValidationError(context)) {
    return new CloudflareImagesValidationProblem(context);
  }

  if (isRetryableUpstreamError(context)) {
    return new CloudflareImagesRetryableUpstreamProblem(context);
  }

  return new CloudflareImagesTerminalUpstreamProblem(context);
}

export function createCloudflareImagesResponseProblem(options: {
  readonly operation: string;
  readonly key?: string;
  readonly status?: number;
  readonly upstreamCode?: string;
  readonly detail?: string;
}): Problem {
  const context: CloudflareImagesErrorContext = {
    provider: "cloudflare-images",
    operation: options.operation,
    ...(options.key !== undefined && { key: options.key }),
    ...(options.status !== undefined && { status: options.status }),
    ...(options.upstreamCode !== undefined && { upstreamCode: options.upstreamCode }),
  };

  if (isValidationError(context)) {
    return new CloudflareImagesValidationProblem(
      context,
      options.detail ?? "Cloudflare Images request validation failed",
    );
  }

  if (isRetryableUpstreamError(context)) {
    return new CloudflareImagesRetryableUpstreamProblem(context);
  }

  return new CloudflareImagesTerminalUpstreamProblem(context);
}

function createCloudflareImagesErrorContext(
  error: unknown,
  options: {
    readonly operation: string;
    readonly key?: string;
    readonly status?: number;
    readonly upstreamCode?: string;
  },
): CloudflareImagesErrorContext {
  const record = asRecord(error);
  const status = firstNumber(options.status, record?.status, record?.statusCode, record?.http_code);
  const upstreamCode = firstString(options.upstreamCode, record?.code, record?.name);

  return {
    provider: "cloudflare-images",
    operation: options.operation,
    ...(options.key !== undefined && { key: options.key }),
    ...(status !== undefined && { status }),
    ...(upstreamCode !== undefined && { upstreamCode }),
  };
}

function isValidationError(context: CloudflareImagesErrorContext): boolean {
  return (
    context.status === 400 ||
    context.status === 401 ||
    context.status === 403 ||
    context.status === 422 ||
    context.upstreamCode === "validation-failed" ||
    context.upstreamCode === "missing-signing-key"
  );
}

function isRetryableUpstreamError(context: CloudflareImagesErrorContext): boolean {
  return (
    context.status === 408 ||
    context.status === 425 ||
    context.status === 429 ||
    (context.status !== undefined && context.status >= 500) ||
    context.upstreamCode === "ECONNRESET" ||
    context.upstreamCode === "ETIMEDOUT" ||
    context.upstreamCode === "UND_ERR_CONNECT_TIMEOUT"
  );
}

function validatePositiveInteger(value: unknown, label: string): void {
  if (value === undefined) {
    return;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new CloudflareImagesValidationProblem(
      {
        provider: "cloudflare-images",
        operation: "configuration",
        upstreamCode: `invalid-${label}`,
      },
      `Cloudflare Images configuration '${label}' must be a positive finite integer`,
    );
  }
}

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|password|secret|token|api[-_]?key|access[-_]?token|signing[-_]?key)/i;

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item));
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
        : sanitizeDiagnosticValue(nestedValue);
    }
    return sanitized;
  }

  return value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function firstNumber(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function firstString(...values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value;
    }
  }

  return undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
