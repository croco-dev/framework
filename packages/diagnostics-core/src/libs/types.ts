export interface DiagnosticsProvider {
  readonly name: string;
  getHealth(): Promise<HealthStatus>;
}

export type HealthStatus = {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly component: string;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly lastChecked: string;
};

export type ErrorRecord = {
  readonly timestamp: string;
  readonly component: string;
  readonly code: string;
  readonly message: string;
  readonly cause?: string;
};

export type DiagnosticsReport = {
  readonly timestamp: string;
  readonly summary: "all_healthy" | "degraded" | "issues_detected";
  readonly components: readonly HealthStatus[];
  readonly recentErrors: readonly ErrorRecord[];
};
