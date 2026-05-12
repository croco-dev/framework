import type {
  HealthIndicator,
  HealthIndicatorResult,
  HealthStatus,
  ReadinessIndicator,
} from "./HealthIndicator";

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
  private readonly readinessIndicators: ReadinessIndicator[] = [];
  private readonly timeout: number;

  constructor(options: HealthCheckServiceOptions = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  register(indicator: HealthIndicator): void {
    this.indicators.push(indicator);
  }

  registerReadiness(indicator: ReadinessIndicator): void {
    this.readinessIndicators.push(indicator);
  }

  isLive(): boolean {
    return true;
  }

  async isReady(): Promise<boolean> {
    if (this.readinessIndicators.length === 0) {
      return true;
    }

    const results = await Promise.all(
      this.readinessIndicators.map((indicator) => this.checkWithTimeout(indicator, "isReady")),
    );

    return results.every((r) => r.status === "up");
  }

  async check(): Promise<HealthCheckResult> {
    const results = await Promise.all(
      this.indicators.map((indicator) => this.checkWithTimeout(indicator, "check")),
    );

    const status = results.every((r) => r.status === "up") ? "up" : "down";

    return { status, results };
  }

  private async checkWithTimeout(
    indicator: HealthIndicator | ReadinessIndicator,
    method: "check" | "isReady",
  ): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<HealthIndicatorResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Health check timeout for ${indicator.constructor.name}`));
      }, this.timeout);
    });

    try {
      const checkFn =
        method === "isReady" && "isReady" in indicator
          ? indicator.isReady.bind(indicator)
          : indicator.check.bind(indicator);
      return await Promise.race([checkFn(controller.signal), timeoutPromise]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        name: indicator.constructor.name,
        status: "down",
        details: { error: message },
      };
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }
}
