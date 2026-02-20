import { Component } from '@croco/framework-context';

export type HealthCheckStatus = 'up' | 'down';

export interface HealthCheckResult {
  status: HealthCheckStatus;
  [key: string]: unknown;
}

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

export interface HealthCheckOptions {
  timeout?: number;
}

@Component({ scope: 'singleton' })
export class HealthCheckRegistry {
  private checks = new Map<string, { fn: HealthCheckFunction; options: HealthCheckOptions }>();

  register(name: string, check: HealthCheckFunction, options: HealthCheckOptions = {}): void {
    this.checks.set(name, { fn: check, options });
  }

  async check(): Promise<{ status: 'ok' | 'error'; checks: Record<string, HealthCheckResult & { error?: string }> }> {
    const results: Record<string, HealthCheckResult & { error?: string }> = {};
    let globalStatus: 'ok' | 'error' = 'ok';

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, { fn, options }]) => {
      const timeout = options.timeout ?? 5000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('timeout')), timeout);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        results[name] = result;
        if (result.status === 'down') {
          globalStatus = 'error';
        }
      } catch (error) {
        globalStatus = 'error';
        results[name] = {
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
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
