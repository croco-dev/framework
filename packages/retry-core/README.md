# @croco/retry-core

재시도(Retry) 정책, 백오프(Backoff) 전략, 서킷브레이커(Circuit Breaker)를 제공하는 Croco 프레임워크 패키지입니다.

## 설치

```bash
npm install @croco/retry-core
# 또는
pnpm add @croco/retry-core
```

## 기능

- **RetryTemplate**: 프로그래밍 방식의 재시도 실행
- **@Retryable**: 선언적인 재시도 데코레이터
- **Circuit Breaker**: 장애 격리 및 자동 복구
- **Backoff Policies**: 지수 백오프, 고정 지연, 지터
- **Lambda Timeout Guard**: AWS Lambda 환경 타임아웃 보호
- **Distributed State Store**: Redis 등 외부 저장소 지원

## 사용법

### RetryTemplate

```typescript
import { RetryTemplate } from '@croco/retry-core';

const template = new RetryTemplate({
  maxAttempts: 3,
  backoff: { delay: 1000, multiplier: 2 },
});

const result = await template.execute(
  async () => await riskyOperation(),
  async (ctx) => fallbackValue
);
```

### @Retryable 데코레이터

```typescript
import { Retryable, Recover } from '@croco/retry-core';

class MyService {
  @Retryable({
    maxAttempts: 3,
    backoff: { delay: 1000, multiplier: 2 },
    circuitBreaker: {
      failureThreshold: 5,
      timeout: 30000,
    },
  })
  async fetchData(): Promise<Data> {
    return await api.get('/data');
  }

  @Recover
  async handleError(error: Error): Promise<Data> {
    return cachedData;
  }
}
```

### Circuit Breaker

```typescript
import { CircuitBreaker, InMemoryCircuitBreakerStateStore } from '@croco/retry-core';

const cb = new CircuitBreaker({
  circuitId: 'my-api',
  failureThreshold: 5,
  openDuration: 30000,
  halfOpenRequests: 3,
});

const result = await cb.execute(async () => await api.call());
```

### Redis 분산 상태 저장소

```typescript
import { RedisCircuitBreakerStore } from '@croco/retry-core';
import { Redis } from 'ioredis';

const store = new RedisCircuitBreakerStore({
  redis: new Redis(),
  ttlSeconds: 60,
  onStoreError: 'fallback-inmemory', // Redis 오류 시 인메모리 폴백
});

const cb = new CircuitBreaker({
  circuitId: 'distributed-api',
  stateStore: store,
});
```

### Lambda Timeout Guard

```typescript
import { setLambdaContext, LambdaTimeoutGuard } from '@croco/retry-core';

export const handler = async (event, context) => {
  setLambdaContext(context);

  const guard = new LambdaTimeoutGuard({ reserveTimeMs: 5000 });
  // 자동으로 Lambda 타임아웃 체크
};
```

## API 요약

### 타입

| 타입 | 설명 |
|------|------|
| `RetryableOptions` | @Retryable 데코레이터 옵션 |
| `CircuitBreakerOptions` | Circuit Breaker 설정 |
| `CircuitBreakerConfig` | CircuitBreaker 세부 설정 |
| `CircuitState` | CLOSED, OPEN, HALF_OPEN |
| `CircuitStateTransition` | 상태 전환 규칙 타입 |
| `BackoffOptions` | 백오프 설정 |
| `BackoffPolicy` | 백오프 인터페이스 |
| `CircuitBreakerFallback<T>` | 폴백 함수 타입 |

### 클래스

| 클래스 | 설명 |
|--------|------|
| `RetryTemplate` | 프로그래밍 방식 재시도 |
| `CircuitBreaker` | 서킷브레이커 |
| `InMemoryCircuitBreakerStateStore` | 인메모리 상태 저장소 |
| `RedisCircuitBreakerStore` | Redis 분산 상태 저장소 |
| `ExponentialBackoff` | 지수 백오프 |
| `FixedBackoff` | 고정 지연 백오프 |
| `NoBackoff` | 지연 없음 |
| `LambdaTimeoutGuard` | Lambda 타임아웃 보호 |
| `RetryOrchestrator` | 재시도 오케스트레이터 |

### 데코레이터

| 데코레이터 | 설명 |
|-----------|------|
| `@Retryable(options)` | 메서드에 재시도 적용 |
| `@Recover` | 재시도 실패 시 복구 메서드 |

### 오류 타입

| 클래스 | 설명 |
|--------|------|
| `CircuitBreakerOpenProblem` | 서킷브레이커 OPEN 상태 |
| `RetryExhaustedProblem` | 재시도 소진 |
| `RetryAbortedProblem` | 재시도 중단 |
| `LambdaTimeoutProblem` | Lambda 타임아웃 |

## 라이선스

MIT
