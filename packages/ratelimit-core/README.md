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
} from "@croco/ratelimit-core";

const store = new SlidingWindowInMemoryStore();
const rateLimiter = new RateLimiter(store, (context) => String(context.get("userId")));

const result = await rateLimiter.check(context, createSlidingWindowPolicy("api", 100, 60_000));
```

```ts
import { RateLimit } from "@croco/ratelimit-core";

class ApiController {
  @RateLimit({ limit: 20, window: "1m", algorithm: "sliding" })
  async list(): Promise<void> {}
}
```

## API 레퍼런스

### 핵심 클래스

- `RateLimiter`, 정책 평가와 저장소 오류 처리까지 담당하는 핵심 서비스입니다.
- `RateLimiter#refund`, `RateLimiter#refundWithKey`, 성공한 체크가 최종적으로 quota를 소비하지 않아야 할 때 해당 체크의 `refundReceipt`로 되돌립니다.
- `RateLimitGuard`, 라우트 메타데이터를 읽어 요청을 차단합니다.
- `RateLimitKeyBuilder`, tenant, user, ip, route 조합으로 키를 생성합니다.

`RateLimitKeyBuilder`는 정책과 각 세그먼트의 이름/값을 구조화한 `rl2:` 키를 생성합니다. 구분자를 포함한
정책명, route, IPv6, Unicode 식별자도 서로 다른 bucket을 유지하며, 빈 문자열과 누락 값도 구분합니다.

### 저장된 rate-limit 키 마이그레이션

이전 `rl:<policy>:<value...>` 키는 세그먼트 경계가 모호하고 `rl2:` namespace를 생성할 수 없으므로 새 코드에서
읽거나 변환하지 않습니다. quota 중복 소비 없이 전환하려면 먼저 구버전으로 향하는 rate-limited 트래픽을
drain하고 모든 구버전 인스턴스를 중지한 뒤, 가장 긴 configured window와 store TTL 중 더 긴 기간 동안
rate-limited 트래픽을 중단하세요. 그 기간이 지나 기존 limiter state가 만료된 것을 확인한 후 `rl2:` 버전을
배포하고 트래픽을 재개합니다. 기존 키는 만료시키거나 운영 정책에 따라 제거할 수 있습니다.

구버전과 신버전 인스턴스를 함께 운영하거나 만료 대기 없이 전환하면 두 namespace가 각각 quota를 부여합니다.
가용성을 위해 이 방식을 선택할 경우 일시적인 quota 증가를 명시적으로 승인하고 모니터링해야 하며, 보안 보존
마이그레이션으로 간주해서는 안 됩니다.

사용자 정의 key builder는 이 변경의 영향을 받지 않습니다. 사용자 정의 키도 자체 version namespace와
충돌 없는 구조화 인코딩을 사용해야 합니다.

### 저장소 구현체

- `FixedWindowInMemoryStore`, `SlidingWindowInMemoryStore`, `TokenBucketInMemoryStore`
- `RateLimitStore`, `DistributedRateLimitStore`, `FixedWindowStore`, `SlidingWindowStore`, `TokenBucketStore`

### 정책과 미들웨어

- `createFixedWindowPolicy`, `createSlidingWindowPolicy`, `createTokenBucketPolicy`
- `createRateLimitMiddleware`, HTTP 미들웨어 생성 헬퍼입니다.
- `@RateLimit`, 메서드 데코레이터 기반 보호 기능입니다.

### 주요 타입과 문제 타입

- `RateLimitPolicy`, `RateLimitResult`, `RateLimitRefundReceipt`, `RateLimitRefundResult`, `RateLimitStats`, `RateLimitAlgorithm`
- `RateLimitDecoratorOptions`, `RateLimitMetadata`, `RateLimitHeaders`, `HttpContext`
- 문제 타입: `RateLimitExceededProblem`, `RateLimitWindowProblem`, `RateLimitKeyBuilderProblem`
- refund 미지원 저장소 문제 타입: `RateLimitRefundUnsupportedProblem`

## 구현 포인트

- 분산 저장소가 필요하면 `RateLimitStore` 계층을 상속해 Redis, Upstash 등으로 확장합니다.
- outcome 기반 HTTP skip처럼 성공한 체크를 되돌려야 하는 어댑터는 `RateLimitResult.refundReceipt`를 `refund()`에 넘겨 quota와 통계를 함께 복구합니다.
- refund는 receipt 기준으로 idempotent하게 동작합니다. 이미 환불됐거나 저장소에 남아 있지 않은 receipt는 quota를 변경하지 않습니다.
- `failOpen` 옵션으로 저장소 장애 시 허용 전략을 선택할 수 있습니다.
- 저장소 장애 시 `resetAtMs`는 장애를 관측한 시각을 기준으로 계산한 추정값입니다. fixed/sliding/legacy 정책은 `windowMs`, token-bucket 정책은 다음 토큰 보충 간격(`refillIntervalMs / refillRate`)을 사용하며, 사용할 수 없는 저장소의 정확한 경계를 의미하지 않습니다.
- `getStats()`는 저장소 통계 조회가 실패하면 `degraded: true`와 직렬화 가능한 `error` 메타데이터를 함께 반환합니다.
- 윈도우 문자열은 `1s`, `1m`, `1h`, `1d` 형식을 사용합니다.
