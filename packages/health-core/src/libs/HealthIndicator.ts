export type HealthStatus = "up" | "down";

export type HealthIndicatorErrorDetails = {
  error: string;
  message?: string;
  code?: string;
};

export type HealthIndicatorSuccessDetails = {
  [key: string]: unknown;
};

export type HealthIndicatorResult = {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: HealthIndicatorErrorDetails | HealthIndicatorSuccessDetails;
  lastChecked?: string;
};

export interface HealthIndicator {
  readonly name?: string;
  check(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}

export interface ReadinessIndicator extends HealthIndicator {
  isReady(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}
