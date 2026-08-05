export interface DiagnosticsProvider {
  readonly name: string;
  getHealth(signal?: AbortSignal): Promise<HealthStatus>;
}

export type DiagnosticsCollectorOptions = {
  /**
   * Default provider timeout in milliseconds. Must be an integer from 1 through 2,147,483,647.
   * Invalid values throw an InvalidDiagnosticsTimeoutProblem during setup.
   */
  readonly timeout?: number;
};

export type DiagnosticsProviderOptions = {
  /**
   * Provider timeout in milliseconds. Must be an integer from 1 through 2,147,483,647.
   * Invalid values throw an InvalidDiagnosticsTimeoutProblem during registration.
   */
  readonly timeout?: number;
};

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
