# @croco/ratelimit-core

고정 윈도우, 슬라이딩 윈도우, 토큰 버킷 알고리즘을 제공하는 레이트 리밋 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/ratelimit-core
```

## 사용법

```ts
import {
  RateLimiter,
  SlidingWindowInMemoryStore,
  createSlidingWindowPolicy,
} from '@croco/ratelimit-core';

const store = new SlidingWindowInMemoryStore();
const rateLimiter = new RateLimiter(store, (context) => String(context.get('userId')));

const result = await rateLimiter.check(context, createSlidingWindowPolicy('api', 100, 60_000));
```

```ts
import { RateLimit } from '@croco/ratelimit-core';

class ApiController {
  @RateLimit({ limit: 20, window: '1m', algorithm: 'sliding' })
  async list(): Promise<void> {}
}
```

## API 레퍼런스

### 핵심 클래스

- `RateLimiter`, 정책 평가와 저장소 오류 처리까지 담당하는 핵심 서비스입니다.
- `RateLimitGuard`, 라우트 메타데이터를 읽어 요청을 차단합니다.
- `RateLimitKeyBuilder`, tenant, user, ip, route 조합으로 키를 생성합니다.

### 저장소 구현체

- `FixedWindowInMemoryStore`, `SlidingWindowInMemoryStore`, `TokenBucketInMemoryStore`
- `RateLimitStore`, `DistributedRateLimitStore`, `FixedWindowStore`, `SlidingWindowStore`, `TokenBucketStore`

### 정책과 미들웨어

- `createFixedWindowPolicy`, `createSlidingWindowPolicy`, `createTokenBucketPolicy`
- `createRateLimitMiddleware`, HTTP 미들웨어 생성 헬퍼입니다.
- `@RateLimit`, 메서드 데코레이터 기반 보호 기능입니다.

### 주요 타입과 문제 타입

- `RateLimitPolicy`, `RateLimitResult`, `RateLimitStats`, `RateLimitAlgorithm`
- `RateLimitDecoratorOptions`, `RateLimitMetadata`, `RateLimitHeaders`, `HttpContext`
- 문제 타입: `RateLimitExceededProblem`, `RateLimitWindowProblem`, `RateLimitKeyBuilderProblem`

## 구현 포인트

- 분산 저장소가 필요하면 `RateLimitStore` 계층을 상속해 Redis, Upstash 등으로 확장합니다.
- `failOpen` 옵션으로 저장소 장애 시 허용 전략을 선택할 수 있습니다.
- 윈도우 문자열은 `1s`, `1m`, `1h`, `1d` 형식을 사용합니다.
