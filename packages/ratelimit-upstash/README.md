# @croco/ratelimit-upstash

Upstash Redis와 Lua 스크립트로 분산 rate limiting을 구현하는 패키지입니다.

## 설치

```bash
pnpm add @croco/ratelimit-upstash @croco/ratelimit-core @upstash/redis
```

## 사용법

```typescript
import { Redis } from "@upstash/redis";
import { UpstashSlidingWindowStore } from "@croco/ratelimit-upstash";
import { RateLimiter, createSlidingWindowPolicy } from "@croco/ratelimit-core";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const store = new UpstashSlidingWindowStore({ redis, prefix: "ratelimit" });
const limiter = new RateLimiter(store, ({ ip }) => ip);
const policy = createSlidingWindowPolicy("api", 100, 60_000);

const result = await limiter.check({ ip: "127.0.0.1" }, policy);
```

## API 레퍼런스

| API                                    | 설명                                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| `createUpstashRateLimitClient`        | Workers bindings로 fetch-only REST 클라이언트를 생성합니다. |
| `UpstashSlidingWindowStore`            | 슬라이딩 윈도우 제한을 수행합니다.                                  |
| `UpstashTokenBucketStore`              | 토큰 버킷 제한을 수행합니다.                                        |
| `UpstashFixedWindowStore`              | 고정 윈도우 제한을 수행합니다.                                      |
| `UpstashRateLimitStoreOptions`         | `redis`, `prefix`, 선택적 `now` clock을 받는 공통 옵션 타입입니다.  |
| `InvalidRateLimitPolicyProblem`        | 저장소와 정책 타입이 맞지 않을 때 발생하는 terminal Problem입니다.  |
| `MissingUpstashRateLimitConfigProblem` | Redis 클라이언트 설정 누락을 나타내는 terminal Problem입니다.       |
| `UpstashRateLimitUpstreamProblem`      | Upstash Redis 오류를 redaction과 retryable evidence로 정규화합니다. |

## 동작 메모

- 세 알고리즘의 check/refund 경로는 Redis Lua 스크립트로 원자성을 보장합니다.
- 세 저장소의 `increment()`는 Redis `INCRBYFLOAT`를 사용하므로 여러 인스턴스의 동시 호출도
  손실 없이 합산됩니다. 유한한 음수와 소수 증분을 지원하며, 기존 카운터 TTL은 증분 후에도
  유지됩니다. `expire()`와 `reset()`은 같은 `:increment` 카운터 키에 적용됩니다.
- 기본 prefix는 저장소별로 `ratelimit:sliding`, `ratelimit:bucket`, `ratelimit:fixed`를 사용합니다.
- `now`를 주입하면 세 저장소의 윈도우 경계와 Redis 스크립트 타임스탬프가 해당 시각을 사용합니다. 생략하면 시스템 시각을 사용합니다.
- 고정 윈도우와 토큰 버킷의 상태 키는 `{prefix:key}`, 환불 영수증 키는
  `{prefix:key}:receipts`를 사용해 Redis Cluster의 같은 슬롯에 배치합니다. prefix와 key 안의
  `%`, `{`, `}`는 각각 `%25`, `%7B`, `%7D`로 인코딩합니다. `check()`, `refund()`, `reset()`이
  같은 키 형식을 사용하며, 슬라이딩 윈도우와 별도 `:increment` 카운터의 키는 유지됩니다.
- 이 키 형식을 처음 사용하는 배포에서는 기존 고정 윈도우·토큰 버킷의 사용량과 환불 영수증을
  이어받지 않고 새 제한 상태로 시작합니다. 기존 키는 설정된 TTL에 따라 만료됩니다.
  구버전과 신버전 인스턴스가 함께 실행되면 서로 다른 제한 상태를 사용하므로, 전환 시 인스턴스를
  함께 교체하고 이전 버전에서 발급한 환불 영수증 처리를 마쳐야 합니다.
- 통계는 메모리 기준으로 allowed, denied, total을 누적합니다.
- Redis upstream 오류는 `UpstashRateLimitUpstreamProblem`으로 변환되며 `retryable` 확장 필드로
  일시 장애와 terminal 오류를 구분합니다. 토큰, secret, credential 형태의 값은 Problem detail에서
  redaction됩니다.

## Conformance

`@croco/testing`의 `createUpstashRedisRateLimitConformanceSuite()`를 패키지 테스트에서 실행합니다.
기본 테스트는 mocked Redis fixture만 사용하므로 Upstash credential이 없어도 통과해야 합니다.

현재 conformance coverage:

- 필수 Redis 클라이언트 누락 Problem
- unsupported policy Problem
- allow/deny stats
- refund idempotency
- retryable upstream failure와 terminal upstream failure 구분
- live smoke env gate skip
- 실제 Upstash Redis에 대한 세 알고리즘의 동시 소수 증분, 음수 증분, TTL 보존, reset

선택적 live smoke는 별도 opt-in env gate(`CROCO_LIVE_UPSTASH_REDIS`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) 뒤에 두어야 합니다. 실제 Upstash backend smoke와
diagnostics/readiness provider는 아직 beta/production promotion blocker입니다.

## Cloudflare Workers

Workers bindings에서 REST credential을 명시적으로 전달합니다. `createUpstashRateLimitClient()`는
Web `fetch`와 Upstash command serializer를 사용하며 Node compatibility flag가 필요하지 않습니다.
HTTP 상태를 보존하므로 429/5xx는 retryable Problem, 401/403은 terminal Problem으로 구분합니다.
응답 본문과 transport 오류 메시지는 진단에 포함하지 않습니다. HTTPS origin만 허용하며 redirect를
따르지 않고 각 명령은 10초 timeout으로 한 번 전송합니다. 응답 손실 전에 Lua 실행이 완료됐을 수
있으므로 retryable은 자동 재시도 허가가 아닙니다.

```typescript typecheck
import { createUpstashRateLimitClient, UpstashFixedWindowStore } from '@croco/ratelimit-upstash';
import { RateLimiter } from '@croco/ratelimit-core';

type Bindings = { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string };

export function createLimiter(env: Bindings, namespace: string) {
  const redis = createUpstashRateLimitClient({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  const store = new UpstashFixedWindowStore({ redis, prefix: `${namespace}:fixed` });
  return new RateLimiter<{ verifiedClientIp: string }>(store, (context) => context.verifiedClientIp, {
    failOpen: false,
  });
}
```

앱 composition root는 알고리즘과 namespace별 저장소를 하나만 선택하여 주입합니다. 서로 다른 앱과
알고리즘에는 별도 prefix를 사용합니다. Upstash와 Durable Object 저장소를 동시에 자동 등록하지
않습니다. DO provider는 별도 구현·검증 대상(#3549)이며 이 패키지에서 지원하거나 인증하지 않습니다.
Workers 전체 SaaS profile 통합(#3537)도 이 adapter의 단독 검증과 별개입니다.

클라이언트 IP는 신뢰할 수 있는 Host 경계에서 확정해 context에 전달합니다. 임의의
`X-Forwarded-For`를 신뢰하지 않습니다. 기존 core middleware의 `failOpen`/`failClosed`,
`X-RateLimit-*`와 `Retry-After` 계약을 그대로 사용합니다. middleware의 기본값은 failClosed이며
직접 생성한 RateLimiter의 기본값은 failOpen이므로 배포 정책을 명시해야 합니다.

`WorkersAdapter.spec.ts`는 실제 workerd에서 공개 entrypoint와 HTTP adapter, 세 알고리즘의
호출, 오류 상태와 redaction을 검사합니다. `pnpm --filter @croco/ratelimit-upstash test:real`은
Docker Redis와 REST fixture를 연결해 서로 다른 isolate의 동시 제한, 환불 중복, namespace 격리,
TTL과 window/refill 경계를 검증합니다. 이 fixture는 실제 Upstash 서비스나 배포된 Cloudflare를
인증하지 않습니다. 패키지는 alpha이며 실제 Upstash live smoke와 readiness/diagnostics 근거는
여전히 미검증입니다. #1687의 공통 숫자 정책 검증은 별도 잔여 작업입니다.
