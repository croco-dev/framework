export type HealthStatus = 'up' | 'down';

export type HealthIndicatorErrorDetails = {
  error: string;
  message?: string;
  code?: string;
};

export type HealthIndicatorSuccessDetails = {
  [key: string]: string | number | boolean | null | undefined;
};

export type HealthIndicatorResult = {
  name: string;
  status: HealthStatus;
  details?: HealthIndicatorErrorDetails | HealthIndicatorSuccessDetails;
};

export interface HealthIndicator {
  check(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}
