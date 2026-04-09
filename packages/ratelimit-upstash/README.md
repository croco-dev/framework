# @croco/ratelimit-upstash

Upstash Redis와 Lua 스크립트로 분산 rate limiting을 구현하는 패키지입니다.

## 설치

```bash
pnpm add @croco/ratelimit-upstash @croco/ratelimit-core @upstash/redis
```

## 사용법

```typescript
import { Redis } from '@upstash/redis';
import { UpstashSlidingWindowStore } from '@croco/ratelimit-upstash';
import { RateLimiter, createSlidingWindowPolicy } from '@croco/ratelimit-core';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const store = new UpstashSlidingWindowStore({ redis, prefix: 'ratelimit' });
const limiter = new RateLimiter(store, ({ ip }) => ip);
const policy = createSlidingWindowPolicy('api', 100, 60_000);

const result = await limiter.check({ ip: '127.0.0.1' }, policy);
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `UpstashSlidingWindowStore` | 슬라이딩 윈도우 제한을 수행합니다. |
| `UpstashTokenBucketStore` | 토큰 버킷 제한을 수행합니다. |
| `UpstashFixedWindowStore` | 고정 윈도우 제한을 수행합니다. |
| `UpstashRateLimitStoreOptions` | `redis`와 `prefix`를 받는 공통 옵션 타입입니다. |
| `InvalidRateLimitPolicyProblem` | 저장소와 정책 타입이 맞지 않을 때 발생합니다. |

## 동작 메모

- 모든 알고리즘은 Redis Lua 스크립트로 원자성을 보장합니다.
- 기본 prefix는 저장소별로 `ratelimit:sliding`, `ratelimit:bucket`, `ratelimit:fixed`를 사용합니다.
- 통계는 메모리 기준으로 allowed, denied, total을 누적합니다.
