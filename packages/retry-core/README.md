# @croco/retry-core

Croco의 재시도 계층입니다. 백오프 정책, 선언형 재시도, 서킷 브레이커, Lambda 실행 시간 보호를 함께 제공합니다.
재시도 가능성은 Croco [Failure Semantics](../../packages/docs/src/content/docs/en/guides/failure-semantics.mdx)의 `ProblemCategory` 기준을 따릅니다.

## 설치

```bash
pnpm add @croco/retry-core
```

## 사용법

### RetryTemplate

```typescript
import { RetryTemplate } from "@croco/retry-core";

const template = new RetryTemplate({
  maxAttempts: 3,
  backoff: { delay: 100, multiplier: 2 },
});

await template.execute(async () => "ok");
```

### `@Retryable`와 `@Recover`

```typescript
import { Recover, Retryable } from "@croco/retry-core";

class PaymentService {
  @Retryable({ maxAttempts: 3, backoff: { delay: 100 } })
  async charge(): Promise<string> {
    return "ok";
  }

  @Recover
  async recoverCharge(): Promise<string> {
    return "fallback";
  }
}
```

### 서킷 브레이커

```typescript
import { CircuitBreaker } from "@croco/retry-core";

const breaker = new CircuitBreaker({
  circuitId: "payments",
  failureThreshold: 5,
  openDuration: 30000,
});
```

### 실패 분류

기본 정책은 `ProblemCategory.InternalServerError`와 `ProblemCategory.TooManyRequests`를 재시도 가능한 transient 실패로 취급합니다. `BadRequest`, `ValidationError`, `BusinessRuleViolation`, `Conflict`, 인증/인가, not-found 계열은 기본적으로 terminal 실패입니다.

`LambdaTimeoutGuard`는 다음 재시도를 시작할 시간이 부족하면 `LambdaTimeoutProblem`을 throw합니다. 열린 서킷은 `CircuitBreakerOpenProblem`을 throw하며 category는 `TooManyRequests`입니다. 두 실패 모두 generic `Error`가 아니라 Croco `Problem`이므로 호출자는 코드와 category로 복구 경로를 판단할 수 있습니다.

## API 레퍼런스

- 재시도 템플릿: `RetryTemplate`, `RetryOrchestrator`, `RetryContext`
- 데코레이터: `Retryable`, `Recover`
- 정책과 백오프: `DefaultRetryPolicy`, `ExponentialBackoff`, `FixedBackoff`, `NoBackoff`
- 서킷 브레이커: `CircuitBreaker`, `CircuitBreakerRetryTemplate`, `CircuitState`, `InMemoryCircuitBreakerStateStore`, `RedisCircuitBreakerStore`
- Lambda 연동: `LambdaTimeoutGuard`, `setLambdaContext`, `getRemainingTimeInMillis`, `hasTimeForRetry`
- Problem 타입: `RetryExhaustedProblem`, `RetryAbortedProblem`, `LambdaTimeoutProblem`, `CircuitBreakerOpenProblem`, `CircuitBreakerUnexpectedStateProblem`
- 타입: `RetryableOptions`, `RetryTemplateOptions`, `BackoffOptions`, `CircuitBreakerOptions`, `RetryListener`
