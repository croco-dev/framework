import {
  InvalidHealthCheckTimeoutProblem,
  MAX_HEALTH_CHECK_TIMEOUT_MS,
} from "./problems/HealthProblems";
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
  /**
   * Timeout in milliseconds. Must be an integer from 1 through 2,147,483,647.
   * Invalid values throw an InvalidHealthCheckTimeoutProblem during service setup or indicator
   * registration.
   */
  timeout?: number;
};

const DEFAULT_TIMEOUT = 5000;

function assertValidTimeout(timeout: number, source: "default" | "indicator"): void {
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_HEALTH_CHECK_TIMEOUT_MS) {
    throw new InvalidHealthCheckTimeoutProblem(source, timeout);
  }
}

type RegisteredIndicator<TIndicator extends HealthIndicator> = {
  readonly indicator: TIndicator;
  readonly timeout?: number;
};

export class HealthCheckService {
  private readonly indicators: RegisteredIndicator<HealthIndicator>[] = [];
  private readonly readinessIndicators: RegisteredIndicator<ReadinessIndicator>[] = [];
  private readonly timeout: number;

  constructor(options: HealthCheckServiceOptions = {}) {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    assertValidTimeout(timeout, "default");
    this.timeout = timeout;
  }

  register(indicator: HealthIndicator, options: HealthCheckServiceOptions = {}): void {
    const timeout = options.timeout;
    if (timeout !== undefined) {
      assertValidTimeout(timeout, "indicator");
    }
    this.indicators.push({ indicator, timeout });
  }

  registerReadiness(indicator: ReadinessIndicator, options: HealthCheckServiceOptions = {}): void {
    const timeout = options.timeout;
    if (timeout !== undefined) {
      assertValidTimeout(timeout, "indicator");
    }
    this.readinessIndicators.push({ indicator, timeout });
  }

  isLive(): boolean {
    return true;
  }

  async isReady(): Promise<boolean> {
    const result = await this.checkReadiness();
    return result.status === "up";
  }

  async check(): Promise<HealthCheckResult> {
    return this.checkIndicators(this.indicators, "check");
  }

  async checkReadiness(): Promise<HealthCheckResult> {
    return this.checkIndicators(this.readinessIndicators, "isReady");
  }

  private async checkIndicators(
    indicators: RegisteredIndicator<HealthIndicator | ReadinessIndicator>[],
    method: "check" | "isReady",
  ): Promise<HealthCheckResult> {
    const results = await Promise.all(
      indicators.map(({ indicator, timeout }) => this.checkWithTimeout(indicator, method, timeout)),
    );

    const status = results.every((r) => r.status === "up") ? "up" : "down";

    return { status, results };
  }

  private async checkWithTimeout(
    indicator: HealthIndicator | ReadinessIndicator,
    method: "check" | "isReady",
    timeoutOverride?: number,
  ): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = timeoutOverride ?? this.timeout;

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
