import { BILLING_PROVIDER_CAPABILITIES } from "@croco/billing-core";
import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import type { PolarConfig } from "../types";
import { POLAR_BILLING_PROVIDER_PROFILE } from "./PolarBillingProviderProfile";
import { normalizePolarBillingError, validatePolarConfig } from "./problems/PolarBillingProblems";

export type PolarReadinessCheckContext = {
  readonly config: PolarConfig;
  readonly signal?: AbortSignal;
};

export type PolarReadinessCheckResult = {
  readonly message?: string;
  readonly details?: Record<string, unknown>;
};

export type PolarBillingDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: PolarReadinessCheckContext,
  ) => Promise<PolarReadinessCheckResult | void>;
};

export class PolarBillingDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "billing-polar";

  constructor(
    private readonly config: Partial<PolarConfig>,
    private readonly options: PolarBillingDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = this.createSafeConfigDetails();
    let validConfig: PolarConfig;

    try {
      validConfig = validatePolarConfig(this.config);
    } catch (error) {
      const problem =
        error instanceof Problem ? error : normalizePolarBillingError(error, "configuration");

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
          "Polar billing configuration is present; live upstream readiness check is not configured",
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
        message: result?.message ?? "Polar billing readiness check passed",
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = normalizePolarBillingError(error, "readiness");

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
      provider: "polar",
      capabilities: Object.fromEntries(
        BILLING_PROVIDER_CAPABILITIES.map((capability) => {
          const availability = POLAR_BILLING_PROVIDER_PROFILE.capabilities[capability];
          return [
            capability,
            availability.supported
              ? { supported: true }
              : { supported: false, reason: availability.reason },
          ];
        }),
      ),
      environment: this.config.environment ?? "missing",
      hasAccessToken: isNonEmptyString(this.config.accessToken),
      hasWebhookSecret: isNonEmptyString(this.config.webhookSecret),
      hasOrganizationId: isNonEmptyString(this.config.organizationId),
    };
  }
}

const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|password|secret|signature|token|api[-_]?key|access[-_]?token)/i;

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
