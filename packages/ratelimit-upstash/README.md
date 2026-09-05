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
| `UpstashSlidingWindowStore`            | 슬라이딩 윈도우 제한을 수행합니다.                                  |
| `UpstashTokenBucketStore`              | 토큰 버킷 제한을 수행합니다.                                        |
| `UpstashFixedWindowStore`              | 고정 윈도우 제한을 수행합니다.                                      |
| `UpstashRateLimitStoreOptions`         | `redis`와 `prefix`를 받는 공통 옵션 타입입니다.                     |
| `InvalidRateLimitPolicyProblem`        | 저장소와 정책 타입이 맞지 않을 때 발생하는 terminal Problem입니다.  |
| `MissingUpstashRateLimitConfigProblem` | Redis 클라이언트 설정 누락을 나타내는 terminal Problem입니다.       |
| `UpstashRateLimitUpstreamProblem`      | Upstash Redis 오류를 redaction과 retryable evidence로 정규화합니다. |

## 동작 메모

- 세 알고리즘의 check/refund 경로는 Redis Lua 스크립트로 원자성을 보장합니다.
- 세 저장소의 `increment()`는 Redis `INCRBYFLOAT`를 사용하므로 여러 인스턴스의 동시 호출도
  손실 없이 합산됩니다. 유한한 음수와 소수 증분을 지원하며, 기존 카운터 TTL은 증분 후에도
  유지됩니다. `expire()`와 `reset()`은 같은 `:increment` 카운터 키에 적용됩니다.
- 기본 prefix는 저장소별로 `ratelimit:sliding`, `ratelimit:bucket`, `ratelimit:fixed`를 사용합니다.
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
