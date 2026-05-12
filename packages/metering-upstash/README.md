# @croco/metering-upstash

`@upstash/redis`를 `@croco/metering-core`에서 요구하는 RedisClient 인터페이스로 연결하는 어댑터입니다.

## 설치

```bash
pnpm add @croco/metering-upstash @upstash/redis
```

## 사용법

```typescript
import { Redis } from "@upstash/redis";
import { createUpstashRedisClient } from "@croco/metering-upstash";
import { IdempotencyManager, RedisUsageStorage } from "@croco/metering-core";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const client = createUpstashRedisClient(redis);
const usageStorage = new RedisUsageStorage(client);
const idempotency = new IdempotencyManager(client);
```

## API 레퍼런스

| API                          | 설명                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `UpstashRedisClient`         | `zadd`, `zrangebyscore`, `set`, `eval`을 metering-core 시그니처로 제공합니다. |
| `createUpstashRedisClient()` | Upstash Redis 인스턴스를 빠르게 어댑터로 감쌉니다.                            |

## 동작 메모

- 서버리스 환경에서 쓰기 쉬운 HTTP 기반 Upstash SDK를 그대로 사용합니다.
- 반환값이 없는 `zadd`는 0으로 정규화합니다.
