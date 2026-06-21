import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import { createSafeR2ConfigDetails, validateR2Options } from "./R2Config";
import { R2ReadinessProblem } from "./problems/R2ReadinessProblem";
import type { R2Options } from "./types";

export type R2ReadinessCheckContext = {
  readonly config: R2Options;
  readonly signal?: AbortSignal;
};

export type R2ReadinessCheckResult = {
  readonly details?: Record<string, unknown>;
  readonly message?: string;
};

export type R2StorageDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: R2ReadinessCheckContext,
  ) => Promise<R2ReadinessCheckResult | void>;
};

export class R2StorageDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "storage-r2";

  constructor(
    private readonly config: Partial<R2Options>,
    private readonly options: R2StorageDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = createSafeR2ConfigDetails(this.config);
    let validConfig: R2Options;

    try {
      validConfig = validateR2Options(this.config);
    } catch (error) {
      const problem = error instanceof Problem ? error : toR2ReadinessProblem(error);

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
          "Cloudflare R2 configuration is present; live upstream readiness check is not configured",
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
        message: result?.message ?? "Cloudflare R2 readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = toR2ReadinessProblem(error);

      return {
        status: "degraded",
        component: this.name,
        message: problem.detail,
        details: {
          ...baseDetails,
          liveCheck: "failed",
          problemCode: problem.code,
          problemStatus: problem.status,
          ...problem.extensions,
        },
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|password|secret|token|api[-_]?key|access[-_]?key|access[-_]?token)/i;

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

function toR2ReadinessProblem(error: unknown): R2ReadinessProblem {
  return new R2ReadinessProblem({
    cause: error instanceof Error ? error : undefined,
    upstreamCode: getDiagnosticErrorCode(error),
    upstreamStatus: getDiagnosticErrorStatus(error),
  });
}

function getDiagnosticErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  if ("$metadata" in error) {
    const metadata = error.$metadata as { httpStatusCode?: number };
    if (typeof metadata.httpStatusCode === "number") {
      return metadata.httpStatusCode;
    }
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

function getDiagnosticErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("name" in error && typeof error.name === "string") {
    return error.name;
  }

  return undefined;
}
