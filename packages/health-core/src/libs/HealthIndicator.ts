export type HealthStatus = 'up' | 'down';

export type HealthIndicatorResult = {
  name: string;
  status: HealthStatus;
  details?: Record<string, unknown>;
};

export interface HealthIndicator {
  check(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}
