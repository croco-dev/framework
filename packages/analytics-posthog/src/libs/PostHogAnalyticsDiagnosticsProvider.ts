import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import type { PostHogConfig } from "@croco/integrations-posthog";
import { PostHogConfigProblem } from "@croco/integrations-posthog";
import { Problem } from "@croco/problems-core";
import { PostHogAnalyticsReadinessProblem } from "./problems/PostHogAnalyticsProblems";

export type PostHogAnalyticsReadinessCheckContext = {
  readonly config: PostHogConfig;
  readonly signal?: AbortSignal;
};

export type PostHogAnalyticsReadinessCheckResult = {
  readonly message?: string;
  readonly details?: Record<string, unknown>;
};

export type PostHogAnalyticsDiagnosticsOptions = {
  readonly enabled?: boolean;
  readonly readinessCheck?: (
    context: PostHogAnalyticsReadinessCheckContext,
  ) => Promise<PostHogAnalyticsReadinessCheckResult | void>;
};

export class PostHogAnalyticsDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "analytics-posthog";

  constructor(
    private readonly config: Partial<PostHogConfig>,
    private readonly options: PostHogAnalyticsDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = this.createSafeConfigDetails();

    if (this.options.enabled === false) {
      return {
        status: "degraded",
        component: this.name,
        message: "PostHog analytics is disabled by configuration; capture calls are skipped",
        details: {
          ...baseDetails,
          liveCheck: "disabled",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    let validConfig: PostHogConfig;

    try {
      validConfig = this.validateConfig();
    } catch (error) {
      const problem = error instanceof Problem ? error : toPostHogReadinessProblem(error);

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
          "PostHog analytics configuration is present; live upstream readiness check is not configured",
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
        message: result?.message ?? "PostHog analytics readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = toPostHogReadinessProblem(error);

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

  private validateConfig(): PostHogConfig {
    if (!isNonEmptyString(this.config.apiKey)) {
      throw new PostHogConfigProblem(
        "[PostHogAnalyticsDiagnosticsProvider] POSTHOG_API_KEY is required for PostHog analytics.",
      );
    }

    const envHost = process.env.POSTHOG_HOST;
    const host = this.config.host ?? envHost;

    if (!isNonEmptyString(host)) {
      throw new PostHogConfigProblem(
        "[PostHogAnalyticsDiagnosticsProvider] PostHog host is required for data residency compliance. " +
          "Set host in config or POSTHOG_HOST env var.",
      );
    }

    return {
      apiKey: this.config.apiKey,
      host,
    };
  }

  private createSafeConfigDetails(): Record<string, unknown> {
    const envHost = process.env.POSTHOG_HOST;
    return {
      provider: "posthog",
      enabled: this.options.enabled !== false,
      hasApiKey: isNonEmptyString(this.config.apiKey),
      hasHost: isNonEmptyString(this.config.host ?? envHost),
      hostSource: this.config.host ? "config" : envHost ? "env" : "missing",
    };
  }
}

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|password|secret|token|api[-_]?key|access[-_]?token)/i;

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

function toPostHogReadinessProblem(error: unknown): PostHogAnalyticsReadinessProblem {
  return new PostHogAnalyticsReadinessProblem({
    cause: error instanceof Error ? error : undefined,
    upstreamCode: getDiagnosticErrorCode(error),
    upstreamStatus: getDiagnosticErrorStatus(error),
  });
}

function getDiagnosticErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
