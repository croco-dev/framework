import type { DiagnosticsProvider, HealthStatus as DiagnosticsHealthStatus } from "./types";

type ReadinessStatus = "up" | "down";

type ReadinessResult = {
  readonly name: string;
  readonly status: ReadinessStatus;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly lastChecked?: string;
};

export type DiagnosticsHealthIndicatorPolicy = {
  /** Health readiness status to report when diagnostics returns `degraded`. */
  readonly degradedStatus: ReadinessStatus;
};

/** Adapts one diagnostics provider to the health readiness indicator contract. */
export class DiagnosticsHealthIndicator {
  readonly name: string;
  private readonly degradedStatus: ReadinessStatus;

  constructor(
    private readonly provider: DiagnosticsProvider,
    policy: DiagnosticsHealthIndicatorPolicy,
  ) {
    this.name = provider.name;
    this.degradedStatus = policy.degradedStatus;
  }

  check(signal?: AbortSignal): Promise<ReadinessResult> {
    return this.getHealth(signal);
  }

  isReady(signal?: AbortSignal): Promise<ReadinessResult> {
    return this.getHealth(signal);
  }

  private async getHealth(signal?: AbortSignal): Promise<ReadinessResult> {
    const result = await this.provider.getHealth(signal);

    return {
      name: result.component,
      status: this.toIndicatorStatus(result.status),
      message: result.message,
      details: result.details,
      lastChecked: result.lastChecked,
    };
  }

  private toIndicatorStatus(status: DiagnosticsHealthStatus["status"]): ReadinessStatus {
    switch (status) {
      case "healthy":
        return "up";
      case "degraded":
        return this.degradedStatus;
      case "unhealthy":
        return "down";
    }
  }
}
