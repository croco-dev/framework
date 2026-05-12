# @croco/retry-core

Croco의 재시도 계층입니다. 백오프 정책, 선언형 재시도, 서킷 브레이커, Lambda 실행 시간 보호를 함께 제공합니다.

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

## API 레퍼런스

- 재시도 템플릿: `RetryTemplate`, `RetryOrchestrator`, `RetryContext`
- 데코레이터: `Retryable`, `Recover`
- 정책과 백오프: `DefaultRetryPolicy`, `ExponentialBackoff`, `FixedBackoff`, `NoBackoff`
- 서킷 브레이커: `CircuitBreaker`, `CircuitBreakerRetryTemplate`, `CircuitState`, `InMemoryCircuitBreakerStateStore`, `RedisCircuitBreakerStore`
- Lambda 연동: `LambdaTimeoutGuard`, `setLambdaContext`, `getRemainingTimeInMillis`, `hasTimeForRetry`
- Problem 타입: `RetryExhaustedProblem`, `RetryAbortedProblem`, `CircuitBreakerOpenProblem`, `CircuitBreakerUnexpectedStateProblem`
- 타입: `RetryableOptions`, `RetryTemplateOptions`, `BackoffOptions`, `CircuitBreakerOptions`, `RetryListener`
