import { Component } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";

export type HealthCheckStatus = "up" | "down";

export interface HealthCheckResult {
  status: HealthCheckStatus;
  [key: string]: unknown;
}

export type HealthCheckFunction = (signal?: AbortSignal) => Promise<HealthCheckResult>;

export interface HealthCheckOptions {
  timeout?: number;
}

@Component({ scope: "singleton" })
/**
 * 이름별 헬스체크를 등록하고 readiness 결과를 집계하는 레지스트리입니다.
 */
export class HealthCheckRegistry {
  private checks = new Map<string, { fn: HealthCheckFunction; options: HealthCheckOptions }>();

  register(name: string, check: HealthCheckFunction, options: HealthCheckOptions = {}): void {
    if (this.checks.has(name)) {
      throw ProblemFactory.internalServerError(
        "transports-http/duplicate-health-check",
        `Duplicate health check registration detected for '${name}'`,
      );
    }

    this.checks.set(name, { fn: check, options });
  }

  async check(): Promise<{
    status: "ok" | "error";
    checks: Record<string, HealthCheckResult & { error?: string }>;
  }> {
    const results: Record<string, HealthCheckResult & { error?: string }> = {};
    let globalStatus: "ok" | "error" = "ok";

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, { fn, options }]) => {
      const timeout = options.timeout ?? 5000;
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error("timeout"));
          }, timeout);
        });

        const result = await Promise.race([fn(controller.signal), timeoutPromise]);
        results[name] = result;
        if (result.status === "down") {
          globalStatus = "error";
        }
      } catch (error) {
        globalStatus = "error";
        results[name] = {
          status: "down",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    });

    await Promise.all(checkPromises);

    return {
      status: globalStatus,
      checks: results,
    };
  }
}
