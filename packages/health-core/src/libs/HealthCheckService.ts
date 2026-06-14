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

type RegisteredIndicator<TIndicator extends HealthIndicator> = {
  readonly indicator: TIndicator;
  readonly options: HealthCheckServiceOptions;
};

export class HealthCheckService {
  private readonly indicators: RegisteredIndicator<HealthIndicator>[] = [];
  private readonly readinessIndicators: RegisteredIndicator<ReadinessIndicator>[] = [];
  private readonly timeout: number;

  constructor(options: HealthCheckServiceOptions = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  register(indicator: HealthIndicator, options: HealthCheckServiceOptions = {}): void {
    this.indicators.push({ indicator, options });
  }

  registerReadiness(indicator: ReadinessIndicator, options: HealthCheckServiceOptions = {}): void {
    this.readinessIndicators.push({ indicator, options });
  }

  isLive(): boolean {
    return true;
  }

  async isReady(): Promise<boolean> {
    if (this.readinessIndicators.length === 0) {
      return true;
    }

    const results = await Promise.all(
      this.readinessIndicators.map(({ indicator, options }) =>
        this.checkWithTimeout(indicator, "isReady", options),
      ),
    );

    return results.every((r) => r.status === "up");
  }

  async check(): Promise<HealthCheckResult> {
    const results = await Promise.all(
      this.indicators.map(({ indicator, options }) =>
        this.checkWithTimeout(indicator, "check", options),
      ),
    );

    const status = results.every((r) => r.status === "up") ? "up" : "down";

    return { status, results };
  }

  private async checkWithTimeout(
    indicator: HealthIndicator | ReadinessIndicator,
    method: "check" | "isReady",
    options: HealthCheckServiceOptions,
  ): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = options.timeout ?? this.timeout;

    const timeoutPromise = new Promise<HealthIndicatorResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Health check timeout for ${getIndicatorName(indicator)}`));
      }, timeout);
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
        name: getIndicatorName(indicator),
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

function getIndicatorName(indicator: HealthIndicator | ReadinessIndicator): string {
  return indicator.name ?? indicator.constructor.name;
}
