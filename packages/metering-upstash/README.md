# @croco/metering-upstash

Upstash Redis 어댑터 for @croco/metering-core

## 설치

```bash
pnpm add @croco/metering-upstash @upstash/redis
```

## 사용법

```typescript
import { Redis } from '@upstash/redis';
import { createUpstashRedisClient } from '@croco/metering-upstash';
import {
  MeteringService,
  MeterRegistry,
  IdempotencyManager,
  RedisUsageStorage,
} from '@croco/metering-core';

// Upstash Redis 클라이언트 생성
const upstashRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// metering-core용 어댑터로 래핑
const redisClient = createUpstashRedisClient(upstashRedis);

// metering-core 구성 요소에서 사용
const usageStorage = new RedisUsageStorage(redisClient);
const idempotencyManager = new IdempotencyManager(redisClient);

const meteringService = new MeteringService({
  meterRegistry,
  usageStorage,
  idempotencyManager,
});
```

## 환경 변수

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

## 서버리스 환경

Upstash는 HTTP/REST 기반으로 동작하므로 다음 환경에서 최적화됩니다:
- Vercel Edge Functions
- Cloudflare Workers
- AWS Lambda
- Next.js API Routes

## 라이선스

MIT
