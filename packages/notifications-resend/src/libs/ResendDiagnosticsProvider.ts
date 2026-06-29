import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import {
  createSafeResendConfigDetails,
  validateResendConfig,
  type ResendConfig,
} from "./ResendConfig";
import {
  normalizeResendProblem,
  sanitizeResendDiagnosticText,
  sanitizeResendDiagnosticValue,
} from "./ResendProblemMapping";

export type ResendReadinessCheckContext = {
  readonly config: ResendConfig;
  readonly signal?: AbortSignal;
};

export type ResendReadinessCheckResult = {
  readonly details?: Record<string, unknown>;
  readonly message?: string;
};

export type ResendDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: ResendReadinessCheckContext,
  ) => Promise<ResendReadinessCheckResult | void>;
};

export class ResendDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "notifications-resend";

  constructor(
    private readonly config: Partial<ResendConfig>,
    private readonly options: ResendDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = createSafeResendConfigDetails(this.config);
    let validConfig: ResendConfig;

    try {
      validConfig = validateResendConfig(this.config);
    } catch (error) {
      const problem = error instanceof Problem ? error : normalizeResendProblem(error, "readiness");

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
          "Resend notification configuration is present; live upstream readiness check is not configured",
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
        message: result?.message
          ? toSafeDiagnosticMessage(result.message)
          : "Resend notification readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeResendDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = normalizeResendProblem(error, "readiness");
      const safeProblemExtensions = toSafeDiagnosticRecord(problem.extensions);

      return {
        status: "degraded",
        component: this.name,
        message: toSafeDiagnosticMessage(problem.detail ?? problem.message),
        details: {
          ...baseDetails,
          liveCheck: "failed",
          problemCode: problem.code,
          problemStatus: problem.status,
          ...safeProblemExtensions,
        },
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

function toSafeDiagnosticMessage(value: string): string {
  return sanitizeResendDiagnosticText(value);
}

function toSafeDiagnosticRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeResendDiagnosticValue(value);

  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}
