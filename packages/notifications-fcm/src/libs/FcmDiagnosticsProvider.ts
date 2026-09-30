import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { validateFcmConfig } from "./FcmConfig";
import type { FcmConfig } from "./FcmConfig";
import { FcmProblem, normalizeFcmProblem } from "./FcmProblem";
import { FCM_PROVIDER_CAPABILITIES } from "./FcmProvider";

export type FcmDiagnosticsOptions = {
  readonly readinessCheck?: (signal?: AbortSignal) => Promise<void>;
};

export class FcmDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "notifications-fcm";
  constructor(
    private readonly config: FcmConfig,
    private readonly options: FcmDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    let configured = false;
    try {
      validateFcmConfig(this.config);
      configured = true;
      await this.options.readinessCheck?.(signal);
      return {
        component: this.name,
        status: "healthy",
        lastChecked: new Date().toISOString(),
        message: this.options.readinessCheck
          ? "FCM readiness check passed"
          : "FCM configuration validated; upstream readiness is unverified",
        details: {
          capabilities: FCM_PROVIDER_CAPABILITIES,
          liveCheck: this.options.readinessCheck ? "passed" : "not_configured",
        },
      };
    } catch (error) {
      const problem = error instanceof FcmProblem ? error : normalizeFcmProblem(error, "readiness");
      return {
        component: this.name,
        status: "unhealthy",
        lastChecked: new Date().toISOString(),
        message: problem.message,
        details: {
          liveCheck: configured ? "failed" : "not_started",
          problemCode: problem.code,
          retryable: problem.extensions?.retryable,
        },
      };
    }
  }
}
