# @croco/metering-upstash

Upstash Redis adapter for the `@croco/metering-core` Redis usage-storage contract.

## Install

```bash
pnpm add @croco/metering-upstash @upstash/redis
```

## Usage

```typescript
import { IdempotencyManager, RedisUsageStorage } from "@croco/metering-core";
import { createUpstashRedisClientFromEnv } from "@croco/metering-upstash";

const client = createUpstashRedisClientFromEnv({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const usageStorage = new RedisUsageStorage(client);
const idempotency = new IdempotencyManager(client);
```

If the application already owns an `@upstash/redis` instance, wrap it directly:

```typescript
import { Redis } from "@upstash/redis";
import { createUpstashRedisClient } from "@croco/metering-upstash";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const client = createUpstashRedisClient(redis);
```

## Public API

| API                                   | Description                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `UpstashRedisClient`                  | Implements `zadd`, `zrangebyscore`, `set`, and `eval` for metering storage. |
| `createUpstashRedisClient()`          | Wraps an existing Upstash Redis SDK instance.                               |
| `createUpstashRedisClientFromEnv()`   | Builds a Redis SDK instance from explicit Upstash REST env values.          |
| `UpstashRedisClientEnv`               | Environment shape accepted by the env factory.                              |
| `MissingUpstashMeteringConfigProblem` | Terminal Problem for missing Redis client, URL, or token configuration.     |
| `UpstashMeteringUpstreamProblem`      | Redacted upstream Redis failure with retryability and status evidence.      |
| `isRetryableUpstashMeteringError()`   | Classifies transient Upstash Redis failures for diagnostics/tests.          |

## Failure Modes

- Missing Redis client, REST URL, or REST token throws `MissingUpstashMeteringConfigProblem` with
  `extensions.retryable: false`.
- Redis command failures throw `UpstashMeteringUpstreamProblem`.
- Upstream status `408`, `429`, and `5xx` are marked retryable. Terminal upstream failures are marked
  non-retryable.
- Error detail is redacted for token, secret, and credential-like values before it reaches the
  Problem detail.

## Conformance

`@croco/testing` provides `createUpstashRedisMeteringConformanceSuite()` and this package runs it in
the package test suite. Default CI uses mocked Redis behavior only, so no Upstash credential is
required.

Current conformance coverage:

- missing configuration Problems;
- Redis usage write/read round trip;
- idempotency duplicate behavior;
- retryable and terminal upstream Problem classification;
- no-credential live-smoke gate skip.

Optional live smoke is gated by all of these env vars:

- `CROCO_LIVE_UPSTASH_REDIS=true`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

```bash
pnpm --filter @croco/metering-upstash test
pnpm --filter @croco/metering-upstash typecheck
```

## Maturity

This package remains alpha. It has no-credential conformance coverage and documented opt-in live
smoke, but beta/production promotion still requires safe diagnostics/readiness evidence and recorded
real-backend and Worker smoke evidence.
