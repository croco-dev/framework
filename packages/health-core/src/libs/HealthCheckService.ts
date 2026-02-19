import type { HealthIndicator, HealthIndicatorResult, HealthStatus } from './HealthIndicator';

export type HealthCheckResult = {
  status: HealthStatus;
  results: HealthIndicatorResult[];
};

export type HealthCheckServiceOptions = {
  timeout?: number;
};

const DEFAULT_TIMEOUT = 5000;

export class HealthCheckService {
  private readonly indicators: HealthIndicator[] = [];
  private readonly timeout: number;

  constructor(options: HealthCheckServiceOptions = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  register(indicator: HealthIndicator): void {
    this.indicators.push(indicator);
  }

  async check(): Promise<HealthCheckResult> {
    const results = await Promise.all(this.indicators.map((indicator) => this.checkWithTimeout(indicator)));

    const status = results.every((r) => r.status === 'up') ? 'up' : 'down';

    return { status, results };
  }

  private checkWithTimeout(indicator: HealthIndicator): Promise<HealthIndicatorResult> {
    const timeoutPromise = new Promise<HealthIndicatorResult>((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout for ${indicator.constructor.name}`)), this.timeout);
    });

    return Promise.race([indicator.check(), timeoutPromise]).catch((error: Error) => ({
      name: indicator.constructor.name,
      status: 'down' as const,
      details: { error: error.message },
    }));
  }
}
