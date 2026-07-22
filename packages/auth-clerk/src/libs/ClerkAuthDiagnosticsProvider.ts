import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import type { ClerkAuthOptions } from "./ClerkAuthProvider";
import { createClerkTokenVerificationProblem } from "./problems/ClerkProblems";

export type ClerkAuthDiagnosticsConfig = Partial<ClerkAuthOptions> & {
  readonly webhookSecret?: string;
};

export type ClerkAuthReadinessCheckContext = {
  readonly config: ClerkAuthOptions;
  readonly signal?: AbortSignal;
};

export type ClerkAuthReadinessCheckResult = {
  readonly details?: Record<string, unknown>;
  readonly message?: string;
};

export type ClerkAuthDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: ClerkAuthReadinessCheckContext,
  ) => Promise<ClerkAuthReadinessCheckResult | void>;
};

const REQUIRED_ENV = ["CLERK_SECRET_KEY"] as const;
const OPTIONAL_ENV = ["CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SECRET"] as const;

export class ClerkAuthDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "auth-clerk";

  constructor(
    private readonly config: ClerkAuthDiagnosticsConfig,
    private readonly options: ClerkAuthDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = this.createSafeConfigDetails();
    const redactionValues = this.getRedactionValues();

    if (!isNonEmptyString(this.config.secretKey)) {
      return {
        status: "unhealthy",
        component: this.name,
        message: "Missing Clerk configuration: CLERK_SECRET_KEY",
        details: {
          ...baseDetails,
          liveCheck: "not_started",
          missing: ["CLERK_SECRET_KEY"],
          problemCode: "auth-clerk/missing-config",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const readyConfig: ClerkAuthOptions = {
      secretKey: this.config.secretKey,
      ...(this.config.publishableKey ? { publishableKey: this.config.publishableKey } : {}),
    };

    if (!this.options.readinessCheck) {
      return {
        status: "healthy",
        component: this.name,
        message: "Clerk configuration is present; live upstream readiness check is not configured",
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
          : "Clerk auth readiness check passed",
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
        error instanceof Problem ? error : createClerkTokenVerificationProblem(error, "readiness");
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
      provider: "clerk",
      requiredEnv: REQUIRED_ENV,
      optionalEnv: OPTIONAL_ENV,
      hasSecretKey: isNonEmptyString(this.config.secretKey),
      hasPublishableKey: isNonEmptyString(this.config.publishableKey),
      hasWebhookSecret: isNonEmptyString(this.config.webhookSecret),
    };
  }

  private getRedactionValues(): string[] {
    return [this.config.secretKey, this.config.webhookSecret].filter(isNonEmptyString);
  }
}

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|clerk[-_]?secret[-_]?key|dsn)/i;

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
  const labelRedacted = value.replace(
    /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|clerk[-_]?secret[-_]?key|dsn)(\s*[:=]\s*)([^,\s;]+)/gi,
    "$1$2[redacted]",
  );

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
