# @croco/health-core

Health check monitoring system for Croco applications.

## Features

- **Type-safe health indicators** with detailed error and success reporting
- **Parallel execution** of all health checks with configurable timeout
- **AbortController support** for cancellable health checks
- **Independent readiness indicators** with detailed aggregate results
- **Stable explicit IDs** with duplicate rejection and disposable registration handles
- **Stable Problems** for invalid registration and timeout configuration

## Installation

```bash
pnpm add @croco/health-core
```

## Quick Start

```typescript
import { HealthCheckService } from "@croco/health-core";
import type { HealthIndicator, HealthIndicatorResult } from "@croco/health-core";

const healthService = new HealthCheckService({ timeout: 5000 });

class DatabaseHealthIndicator implements HealthIndicator {
  async check(signal?: AbortSignal): Promise<HealthIndicatorResult> {
    try {
      await this.db.ping();

      return {
        name: "database",
        status: "up",
        details: { latency: 15, connections: 5 },
      };
    } catch (error) {
      return {
        name: "database",
        status: "down",
        details: {
          error: error instanceof Error ? error.message : String(error),
          code: "DB_CONNECTION_ERROR",
        },
      };
    }
  }
}

const registration = healthService.register("database", new DatabaseHealthIndicator());

const result = await healthService.check();
console.log(result.status); // 'up' | 'down'
console.log(result.results); // Array of individual check results

registration.dispose(); // Removes only the database indicator from future checks
```

## API Reference

### HealthIndicator

Interface for implementing custom health checks.

```typescript
interface HealthIndicator {
  check(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}
```

### HealthIndicatorResult

Result type returned by health checks.

```typescript
type HealthIndicatorResult = {
  name: string;
  status: "up" | "down";
  message?: string;
  details?: HealthIndicatorErrorDetails | HealthIndicatorSuccessDetails;
  lastChecked?: string;
};
```

**Success details:**

```typescript
type HealthIndicatorSuccessDetails = {
  [key: string]: unknown;
};
```

Example: `{ latency: 15, connections: 5, version: '1.2.3' }`

**Error details:**

```typescript
type HealthIndicatorErrorDetails = {
  error: string;
  message?: string;
  code?: string;
};
```

Example: `{ error: 'Connection timeout', code: 'ETIMEDOUT' }`

### HealthCheckService

Orchestrates health check execution.

```typescript
class HealthCheckService {
  constructor(options?: { timeout?: number });

  register(
    id: string,
    indicator: HealthIndicator,
    options?: { timeout?: number },
  ): HealthIndicatorRegistration;
  registerReadiness(
    id: string,
    indicator: ReadinessIndicator,
    options?: { timeout?: number },
  ): HealthIndicatorRegistration;
  check(): Promise<HealthCheckResult>;
  checkReadiness(): Promise<HealthCheckResult>;
  isReady(): Promise<boolean>;
}

interface HealthIndicatorRegistration {
  dispose(): void;
}
```

Generic health and readiness indicators are separate collections. `check()` evaluates only generic
indicators, while `checkReadiness()` and `isReady()` evaluate only readiness indicators. An empty
readiness collection is considered `up`.

Explicit IDs are the component names returned in reports, regardless of indicator class names or the
`name` field returned by the indicator. Duplicate IDs throw `DuplicateHealthIndicatorProblem` within
the same namespace, while health and readiness may use the same ID. IDs must be non-empty and contain
no surrounding whitespace. `dispose()` is idempotent and affects future checks; a check already in
progress keeps the registration snapshot it started with.

The legacy `register(indicator, options)` and `registerReadiness(indicator, options)` overloads remain
available for migration but are deprecated because their report names are not explicit stable IDs.

Default and per-indicator timeouts must be integer milliseconds between `1` and `2_147_483_647`.
Invalid values throw `InvalidHealthCheckTimeoutProblem` during setup before any health check runs.

### ReadinessIndicator

```typescript
interface ReadinessIndicator extends HealthIndicator {
  isReady(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}
```

## Examples

### Database Health Check

```typescript
class PostgresHealthIndicator implements ReadinessIndicator {
  constructor(private readonly pool: Pool) {}

  async check(): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      await this.pool.query("SELECT 1");
      const latency = Date.now() - start;

      return {
        name: "postgres",
        status: "up",
        details: { latency, idleCount: this.pool.idleCount },
      };
    } catch (error) {
      return {
        name: "postgres",
        status: "down",
        details: { error: String(error), code: "POSTGRES_ERROR" },
      };
    }
  }

  async isReady(): Promise<HealthIndicatorResult> {
    return this.check();
  }
}
```

### Redis Health Check

```typescript
class RedisHealthIndicator implements ReadinessIndicator {
  constructor(private readonly redis: Redis) {}

  async check(signal?: AbortSignal): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        name: "redis",
        status: "up",
        details: { latency, connectedClients: await this.redis.client("LIST") },
      };
    } catch (error) {
      return {
        name: "redis",
        status: "down",
        details: { error: String(error) },
      };
    }
  }

  async isReady(signal?: AbortSignal): Promise<HealthIndicatorResult> {
    return this.check(signal);
  }
}
```

### External API Health Check

```typescript
class ApiHealthIndicator implements HealthIndicator {
  async check(signal?: AbortSignal): Promise<HealthIndicatorResult> {
    try {
      const response = await fetch("https://api.example.com/health", {
        signal,
      });

      if (!response.ok) {
        return {
          name: "external-api",
          status: "down",
          details: {
            error: `HTTP ${response.status}`,
            code: String(response.status),
          },
        };
      }

      return {
        name: "external-api",
        status: "up",
        details: { latency: response.headers.get("X-Response-Time") },
      };
    } catch (error) {
      return {
        name: "external-api",
        status: "down",
        details: { error: String(error) },
      };
    }
  }
}
```

## Integration with HTTP Endpoints

```typescript
import { Hono } from "hono";
import { HealthCheckService } from "@croco/health-core";

const app = new Hono();
const healthService = new HealthCheckService();

healthService.registerReadiness("postgres", new PostgresHealthIndicator(pool));
healthService.registerReadiness("redis", new RedisHealthIndicator(redis));

app.get("/ready", async (c) => {
  const result = await healthService.checkReadiness();
  return c.json(result, result.status === "up" ? 200 : 503);
});
```

## License

MIT
