# @croco/ratelimit-upstash

Upstash Redis 기반 분산 Rate Limiting 구현체

## 설치

```bash
pnpm add @croco/ratelimit-upstash @croco/ratelimit-core @upstash/redis
```

## Upstash 설정

### 환경 변수 설정

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Upstash 프로젝트 설정

[Upstash Console](https://console.upstash.com)에서 Redis 데이터베이스를 생성하고 REST API URL과 Token을 발급받습니다.

## 사용법

### 슬라이딩 윈도우 (Sliding Window)

```typescript
import { Redis } from '@upstash/redis';
import { UpstashSlidingWindowStore } from '@croco/ratelimit-upstash';
import { RateLimiter, createSlidingWindowPolicy } from '@croco/ratelimit-core';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const store = new UpstashSlidingWindowStore({ redis, prefix: 'ratelimit' });
const limiter = new RateLimiter(store, (ctx) => ctx.ip);

const policy = createSlidingWindowPolicy('api', 100, 60000);

const result = await limiter.check({ ip: '192.168.1.1' }, policy);
// result.success: boolean
// result.remaining: number
// result.resetAtMs: number
```

### 토큰 버킷 (Token Bucket)

```typescript
import { UpstashTokenBucketStore } from '@croco/ratelimit-upstash';
import { createTokenBucketPolicy } from '@croco/ratelimit-core';

const store = new UpstashTokenBucketStore({ redis, prefix: 'ratelimit' });
const limiter = new RateLimiter(store, (ctx) => ctx.userId);

const policy = createTokenBucketPolicy('burst', 10, 1, 1000);
// capacity: 10, refillRate: 1 token per 1000ms

const result = await limiter.check({ userId: 'user-123' }, policy);
```

### 고정 윈도우 (Fixed Window)

```typescript
import { UpstashFixedWindowStore } from '@croco/ratelimit-upstash';
import { createFixedWindowPolicy } from '@croco/ratelimit-core';

const store = new UpstashFixedWindowStore({ redis, prefix: 'ratelimit' });
const limiter = new RateLimiter(store, (ctx) => ctx.apiKey);

const policy = createFixedWindowPolicy('api-key', 1000, 3600000);
// limit: 1000 requests per hour

const result = await limiter.check({ apiKey: 'key-xxx' }, policy);
```

## API

### UpstashSlidingWindowStore

슬라이딩 윈도우 알고리즘을 Redis Lua 스크립트로 구현한 Store입니다.

```typescript
class UpstashSlidingWindowStore extends SlidingWindowStore {
  constructor(options: {
    redis: Redis;
    prefix?: string;
  });

  check(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  getStats(): Promise<RateLimitStats>;
}
```

### UpstashTokenBucketStore

토큰 버킷 알고리즘을 Redis Lua 스크립트로 구현한 Store입니다.

```typescript
class UpstashTokenBucketStore extends TokenBucketStore {
  constructor(options: {
    redis: Redis;
    prefix?: string;
  });

  check(key: string, policy: TokenBucketPolicy): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  getStats(): Promise<RateLimitStats>;
}
```

### UpstashFixedWindowStore

고정 윈도우 알고리즘을 Redis Lua 스크립트로 구현한 Store입니다.

```typescript
class UpstashFixedWindowStore extends FixedWindowStore {
  constructor(options: {
    redis: Redis;
    prefix?: string;
  });

  check(key: string, policy: FixedWindowPolicy): Promise<RateLimitResult>;
  increment(key: string, amount?: number): Promise<number>;
  getCount(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  expire(key: string, ttlMs: number): Promise<void>;
  getStats(): Promise<RateLimitStats>;
}
```

## Redis Lua 스크립트

모든 알고리즘은 Redis Lua 스크립트를 사용하여 원자적 연산을 보장합니다:

- **슬라이딩 윈도우**: `ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` + `EXPIRE`
- **토큰 버킷**: `GET` + `SET` + 토큰 리필 계산
- **고정 윈도우**: `GET` + `INCR` + `EXPIRE`

## 서버리스 환경

Upstash는 HTTP/REST 기반으로 동작하므로 다음 환경에서 최적화됩니다:

- Vercel Edge Functions
- Cloudflare Workers
- AWS Lambda
- Next.js API Routes

## 라이선스

MIT
