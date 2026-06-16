import { Component } from "@croco/framework-context";
import {
  HealthCheckService,
  type HealthIndicator,
  type HealthIndicatorResult,
  type HealthStatus,
  type HealthCheckResult as CoreHealthCheckResult,
  type HealthCheckServiceOptions,
} from "@croco/health-core";
import { ProblemFactory } from "@croco/problems-core";

export type HealthCheckStatus = HealthStatus;

export interface HealthCheckResult {
  status: HealthCheckStatus;
  [key: string]: unknown;
}

export type HealthCheckFunction = (signal?: AbortSignal) => Promise<HealthCheckResult>;

export interface HealthCheckOptions extends HealthCheckServiceOptions {}

export interface HealthCheckRegistryResult extends CoreHealthCheckResult {}

@Component({ scope: "singleton" })
/**
 * 이름별 헬스체크를 등록하고 readiness 결과를 집계하는 레지스트리입니다.
 */
export class HealthCheckRegistry {
  private checks = new Map<string, HealthCheckFunction>();
  private readonly service = new HealthCheckService();

  register(name: string, check: HealthCheckFunction, options: HealthCheckOptions = {}): void {
    if (this.checks.has(name)) {
      throw ProblemFactory.internalServerError(
        "transports-http/duplicate-health-check",
        `Duplicate health check registration detected for '${name}'`,
      );
    }

    this.checks.set(name, check);
    this.service.register(new RegisteredHealthCheckIndicator(name, check), options);
  }

  getRegisteredCheckCount(): number {
    return this.checks.size;
  }

  async check(): Promise<HealthCheckRegistryResult> {
    return this.service.check();
  }
}

class RegisteredHealthCheckIndicator implements HealthIndicator {
  readonly name: string;

  constructor(
    name: string,
    private readonly checkFn: HealthCheckFunction,
  ) {
    this.name = name;
  }

  async check(signal?: AbortSignal): Promise<HealthIndicatorResult> {
    const { status, ...details } = await this.checkFn(signal);
    const detailEntries = Object.entries(details);

    return {
      name: this.name,
      status,
      ...(detailEntries.length > 0
        ? {
            details: Object.fromEntries(detailEntries) as HealthIndicatorResult["details"],
          }
        : {}),
    };
  }
}
