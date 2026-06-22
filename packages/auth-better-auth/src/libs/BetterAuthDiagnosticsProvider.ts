import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import type { BetterAuthConfig } from "./BetterAuthFactory";
import { BetterAuthAuthenticationProblem } from "./problems/BetterAuthAuthenticationProblem";
import { redactSensitiveValue, SENSITIVE_DIAGNOSTIC_KEY } from "./redaction";

export type BetterAuthDiagnosticsConfig = Partial<BetterAuthConfig> & {
  readonly databaseConfigured?: boolean;
  readonly webhookSecret?: string;
};

export type BetterAuthReadinessCheckContext = {
  readonly config: BetterAuthConfig;
  readonly signal?: AbortSignal;
};

export type BetterAuthReadinessCheckResult = {
  readonly details?: Record<string, unknown>;
  readonly message?: string;
};

export type BetterAuthDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: BetterAuthReadinessCheckContext,
  ) => Promise<BetterAuthReadinessCheckResult | void>;
};

const REQUIRED_ENV = ["BETTER_AUTH_URL", "BETTER_AUTH_SECRET"] as const;
const OPTIONAL_ENV = ["BETTER_AUTH_WEBHOOK_SECRET"] as const;

export class BetterAuthDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "auth-better-auth";

  constructor(
    private readonly config: BetterAuthDiagnosticsConfig,
    private readonly options: BetterAuthDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = this.createSafeConfigDetails();
    const missing = this.getMissingConfiguration();
    const redactionValues = this.getRedactionValues();

    if (missing.length > 0) {
      return {
        status: "unhealthy",
        component: this.name,
        message: `Missing Better Auth configuration: ${missing.join(", ")}`,
        details: {
          ...baseDetails,
          liveCheck: "not_started",
          missing,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const readyConfig: BetterAuthConfig = {
      baseURL: this.config.baseURL as string,
      secret: this.config.secret as string,
    };

    if (!this.options.readinessCheck) {
      return {
        status: "healthy",
        component: this.name,
        message:
          "Better Auth configuration is present; live upstream readiness check is not configured",
        details: {
          ...baseDetails,
          liveCheck: "not_configured",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      const result = await this.options.readinessCheck({
        config: readyConfig,
        signal,
      });

      return {
        status: "healthy",
        component: this.name,
        message: result?.message
          ? sanitizeDiagnosticText(result.message, redactionValues)
          : "Better Auth readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && {
            readiness: sanitizeDiagnosticValue(result.details, redactionValues),
          }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem =
        error instanceof Problem ? error : new BetterAuthAuthenticationProblem("readiness", error);
      const message = sanitizeDiagnosticText(problem.detail ?? problem.message, redactionValues);

      return {
        status: "degraded",
        component: this.name,
        message,
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
      provider: "better-auth",
      requiredEnv: REQUIRED_ENV,
      optionalEnv: OPTIONAL_ENV,
      hasBaseURL: isNonEmptyString(this.config.baseURL),
      hasSecret: isNonEmptyString(this.config.secret),
      hasWebhookSecret: isNonEmptyString(this.config.webhookSecret),
      hasDatabase: this.config.databaseConfigured !== false,
    };
  }

  private getMissingConfiguration(): string[] {
    const missing: string[] = [];

    if (!isNonEmptyString(this.config.baseURL)) {
      missing.push("BETTER_AUTH_URL");
    }

    if (!isNonEmptyString(this.config.secret)) {
      missing.push("BETTER_AUTH_SECRET");
    }

    if (this.config.databaseConfigured === false) {
      missing.push("database connection supplied by app");
    }

    return missing;
  }

  private getRedactionValues(): string[] {
    return [this.config.secret, this.config.webhookSecret].filter(isNonEmptyString);
  }
}

function sanitizeDiagnosticValue(value: unknown, redactionValues: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item, redactionValues));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
    };
  }

  if (typeof value === "string") {
    return sanitizeDiagnosticText(value, redactionValues);
  }

  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = SENSITIVE_DIAGNOSTIC_KEY.test(key)
        ? "[redacted]"
        : sanitizeDiagnosticValue(nestedValue, redactionValues);
    }
    return sanitized;
  }

  return value;
}

function sanitizeDiagnosticText(value: string, redactionValues: readonly string[]): string {
  const labelRedacted = redactSensitiveValue(value);

  return redactKnownValues(labelRedacted, redactionValues);
}

function redactKnownValues(value: string, redactionValues: readonly string[]): string {
  let redacted = value;
  for (const secret of redactionValues) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
