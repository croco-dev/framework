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

숫자형 신뢰성 옵션은 생성 또는 실행 경계에서 검증됩니다. 백오프 `delay`와 Lambda의 reserve/delay는
0 이상 정수이고, `maxDelay`, `openDuration`, circuit breaker `timeout`은 1~2,147,483,647ms 정수입니다.
`multiplier`는 양의 유한수이며, `maxAttempts`, `halfOpenRequests`, `failureThreshold`, `successThreshold`, Redis
`ttlSeconds`는 양의 안전 정수입니다. 잘못된 값은 상태 접근,
사용자 콜백, sleep 또는 Redis I/O 전에 `InvalidRetryConfigurationProblem`으로 거부됩니다. 옵션을 생략하면
기존 기본값을 사용합니다.

`@Retryable`에 서킷 브레이커를 설정하면 같은 decorated method의 모든 서비스 인스턴스가 resolved circuit ID별 상태를 현재 프로세스에서 공유합니다. `circuitIdResolver`가 서로 다른 ID를 반환하면 상태도 격리됩니다.

```typescript
import { RedisCircuitBreakerStore, Retryable } from "@croco/retry-core";

const stateStore = new RedisCircuitBreakerStore({ redis });

class PaymentService {
  @Retryable({
    maxAttempts: 1,
    circuitBreaker: {
      failureThreshold: 5,
      timeout: 30000,
      stateStore,
    },
    circuitIdResolver: ({ args, defaultCircuitId }) => `${defaultCircuitId}:${String(args[0])}`,
  })
  async charge(tenantId: string): Promise<string> {
    return gateway.charge(tenantId);
  }
}
```

기본 저장소와 breaker registry는 decorated method가 로드된 동안 유지됩니다. 기본 저장소의 idle retention은 최소 5분이며, 명시적인 `timeout`에는 첫 HALF_OPEN 전환을 보장하기 위한 5분이 추가됩니다. 비활성 registry 항목은 5분 또는 1,000개 한도에서 제거되지만, 제거 과정은 상태 저장소를 reset하지 않습니다. 프로세스나 런타임 간 OPEN/HALF_OPEN 상태 공유가 필요하면 같은 분산 `stateStore`를 명시적으로 전달해야 합니다. 분산 저장소는 저장된 상태를 공유하며, breaker 인스턴스 내부의 CLOSED 동시 실행 카운터까지 프로세스 간 공유하지는 않습니다.

### 실패 분류

기본 정책은 `ProblemCategory.InternalServerError`와 `ProblemCategory.TooManyRequests`를 재시도 가능한 transient 실패로 취급합니다. `BadRequest`, `ValidationError`, `BusinessRuleViolation`, `Conflict`, 인증/인가, not-found 계열은 기본적으로 terminal 실패입니다.

`LambdaTimeoutGuard`는 다음 재시도를 시작할 시간이 부족하면 `LambdaTimeoutProblem`을 throw합니다. 열린 서킷은 `CircuitBreakerOpenProblem`을 throw하며 category는 `TooManyRequests`입니다. 두 실패 모두 generic `Error`가 아니라 Croco `Problem`이므로 호출자는 코드와 category로 복구 경로를 판단할 수 있습니다.

서킷 브레이커의 보호 대상 작업이 성공한 뒤 상태 저장소의 성공 bookkeeping이 실패하더라도 완료된 작업 결과는 실패로 바뀌지 않으며 실패 카운터도 증가하지 않습니다. 활성 trace에는 `circuit_breaker.bookkeeping_failed` 이벤트가 기록되므로 저장소 장애를 업무 작업의 재시도와 분리해 관찰할 수 있습니다.

업무 콜백이 성공한 뒤 `RetryListener.onSuccess` 또는 저수준 `RetryHooks.onSuccess`가 실패하면 콜백과 recovery는 다시 실행되지 않습니다. 대신 `RetrySuccessHookProblem`이 throw되며 `callbackSucceeded: true`, 훅 이름, 메서드 이름, 성공 시도 횟수와 원래 오류를 제공합니다. 따라서 호출자는 성공한 비멱등 작업을 재호출하지 않고 관측·리스너 장애를 별도로 처리해야 합니다.

## API 레퍼런스

- 재시도 템플릿: `RetryTemplate`, `RetryOrchestrator`, `RetryContext`
- 데코레이터: `Retryable`, `Recover`
- 정책과 백오프: `DefaultRetryPolicy`, `ExponentialBackoff`, `FixedBackoff`, `NoBackoff`
- 서킷 브레이커: `CircuitBreaker`, `CircuitBreakerRetryTemplate`, `CircuitState`, `InMemoryCircuitBreakerStateStore`, `RedisCircuitBreakerStore`
- Lambda 연동: `LambdaTimeoutGuard`, `setLambdaContext`, `getRemainingTimeInMillis`, `hasTimeForRetry`
- Problem 타입: `RetryExhaustedProblem`, `RetryAbortedProblem`, `RetrySuccessHookProblem`, `LambdaTimeoutProblem`, `CircuitBreakerOpenProblem`, `CircuitBreakerUnexpectedStateProblem`, `InvalidRetryConfigurationProblem`
- 타입: `RetryableOptions`, `RetryTemplateOptions`, `RetryHooks`, `BackoffOptions`, `CircuitBreakerConfig`, `CircuitBreakerOptions`, `RetryListener`
