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

  private async checkWithTimeout(indicator: HealthIndicator): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<HealthIndicatorResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Health check timeout for ${indicator.constructor.name}`));
      }, this.timeout);
    });

    try {
      return await Promise.race([indicator.check(controller.signal), timeoutPromise]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        name: indicator.constructor.name,
        status: 'down',
        details: { error: message },
      };
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }
}
